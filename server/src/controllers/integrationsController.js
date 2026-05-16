const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const config = require('../config/env');
const openaiService = require('../services/openaiService');
const manychatService = require('../services/manychatService');
const { getDiscountForService } = require('../services/discountService');
const { formatCurrency } = require('../utils/helpers');
const { resolveWhatsAppChatLink } = require('../utils/clinicLinks');

const DEFAULT_QUICK_REPLIES = ['احجز', 'استفسار'];
const DEFAULT_CALLBACK_PROMPT = 'إذا تحب نخلي الاستقبال يتواصل وياك، ابعت رقمك هنا وسنتواصل معك.';
const MANYCHAT_LOG_PATH = path.join(process.cwd(), 'manychat-debug.log');
const SOCIAL_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const socialSessions = new Map();

const PLATFORM_MAP = {
  facebook: 'FACEBOOK',
  instagram: 'INSTAGRAM',
};

const DAY_LABELS = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

const GREETING_ONLY_PATTERN = /^(?:\s)*(?:السلام(?:\s+عليكم)?|سلام(?:\s+عليكم)?|مرحبا|اهلا|أهلا|هاي|hello|hi|hey|start)(?:\s)*$/i;

const pruneSocialSessions = () => {
  const now = Date.now();
  for (const [key, session] of socialSessions.entries()) {
    if (!session?.updatedAt || now - session.updatedAt > SOCIAL_SESSION_TTL_MS) {
      socialSessions.delete(key);
    }
  }
};

const getSocialSession = (key) => {
  pruneSocialSessions();
  const session = socialSessions.get(key);
  if (!session) return null;
  return session;
};

const setSocialSession = (key, data) => {
  socialSessions.set(key, {
    ...data,
    updatedAt: Date.now(),
  });
};

const clearSocialSession = (key) => {
  socialSessions.delete(key);
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizePlatform = (value) => PLATFORM_MAP[String(value || '').trim().toLowerCase()] || 'FACEBOOK';
const isTemplatePlaceholder = (value) => /^\{\{[^}]+\}\}$/.test(String(value || '').trim());
const parseJsonObject = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};
const getFullContactData = (body) => parseJsonObject(body?.full_contact_data);

const toAbsoluteUrl = (req, url) => {
  const raw = String(url || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const baseUrl = (
    config.publicBaseUrl ||
    config.dashboardUrl ||
    `${req.protocol}://${req.get('host')}`
  ).replace(/\/$/, '');

  try {
    return new URL(raw, `${baseUrl}/`).toString();
  } catch {
    return raw;
  }
};

const pickFirstString = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() && !isTemplatePlaceholder(value)) {
      return value.trim();
    }
  }

  return '';
};

const writeManyChatLog = (label, payload) => {
  try {
    const line = `[${new Date().toISOString()}] ${label} ${JSON.stringify(payload)}\n`;
    fs.appendFileSync(MANYCHAT_LOG_PATH, line, 'utf8');
  } catch (error) {
    console.error('[ManyChat] Failed to write debug log:', error.message);
  }
};

const timingSafeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const walkStrings = (value, pathName = '', depth = 0, results = []) => {
  if (depth > 4 || value == null) return results;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && !isTemplatePlaceholder(trimmed)) {
      results.push({ path: pathName.toLowerCase(), value: trimmed });
    }
    return results;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkStrings(entry, `${pathName}[${index}]`, depth + 1, results));
    return results;
  }

  if (typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      const nextPath = pathName ? `${pathName}.${key}` : key;
      walkStrings(entry, nextPath, depth + 1, results);
    });
  }

  return results;
};

const readIncomingText = (body) => {
  const fullContactData = getFullContactData(body);
  const direct = pickFirstString(
    body?.message_text,
    body?.comment_text,
    body?.comment_message,
    body?.last_comment_text,
    body?.text,
    body?.message,
    body?.input,
    body?.content,
    body?.comment?.text,
    body?.comment?.message,
    body?.data?.comment_text,
    body?.data?.text,
    body?.data?.message,
    body?.trigger?.comment_text,
    body?.trigger?.message_text,
    body?.last_text_input,
    fullContactData?.last_text_input,
    fullContactData?.comment_text,
    fullContactData?.comment?.text,
    fullContactData?.comment?.message,
    fullContactData?.message_text,
    fullContactData?.text
  );

  if (direct) return direct;

  const candidates = walkStrings({
    ...body,
    ...(fullContactData ? { full_contact_data: fullContactData } : {}),
  })
    .filter(({ path, value }) => {
      if (value.length < 2) return false;
      if (/token|authorization|verify|webhook|subscriber_id|contact_id|platform|channel|full_name/i.test(path)) return false;
      if (/api_|reply_text|image_url|callback|intent|custom_fields|fields/i.test(path)) return false;
      return /(comment|message|text|caption|content|reply|input)/i.test(path);
    })
    .map(({ value }) => value);

  return candidates[0] || '';
};

const readSourceType = (body) => pickFirstString(body?.source_type, body?.trigger_type).toLowerCase() || 'chat';

const readSubscriberId = (body) => {
  const fullContactData = getFullContactData(body);
  return pickFirstString(
    body?.subscriber_id,
    body?.contact_id,
    body?.user_id,
    body?.sender_id,
    body?.id,
    fullContactData?.contact_id
  );
};

const readManychatContactId = (body) => {
  const fullContactData = getFullContactData(body);
  return pickFirstString(body?.contact_id, fullContactData?.contact_id);
};

const readFullName = (body) => {
  const fullContactData = getFullContactData(body);
  return pickFirstString(
    body?.full_name,
    body?.name,
    [body?.first_name, body?.last_name].filter(Boolean).join(' '),
    fullContactData?.full_name
  );
};

const readCommentMetadata = (body) => ({
  commentId: pickFirstString(
    body?.comment_id,
    body?.commentId,
    body?.comment?.id,
    body?.data?.comment_id,
    body?.trigger?.comment_id
  ),
  postId: pickFirstString(
    body?.post_id,
    body?.postId,
    body?.media_id,
    body?.mediaId,
    body?.data?.post_id,
    body?.trigger?.post_id
  ),
});

const isPlaceholderName = (value) => {
  const normalized = String(value || '').trim();
  return !normalized || isTemplatePlaceholder(normalized) || normalized.toLowerCase() === 'full name';
};

const normalizeDigits = (value = '') =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[^\d+]/g, '');

const extractPhoneNumber = (value = '') => {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/(?:\+?\d){7,15}/);
  return match ? match[0] : null;
};

const normalizeLookupText = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isFollowUpMessage = (value = '') =>
  /^(?:\?+|؟+|ارجو الرد|أرجو الرد|رد|طيب|طب|تمام|اوكي|أوكي|يعني|زين|اي|أي|بليل|بالليل|ساعه\s*\d+|ساعة\s*\d+)/i.test(
    String(value || '').trim()
  );

const isAcknowledgement = (value = '') =>
  /^(?:تمام|اوكي|أوكي|شكرا|شكرًا|تسلم|تسلمين|يسلمو|حبيبي|حبيبتي|♥️|❤️)+$/i.test(String(value || '').trim());

const formatWorkingHours = (workingHours = {}, heading = 'مواعيد العمل') => {
  if (!workingHours || typeof workingHours !== 'object') {
    return `${heading} غير متاحة حالياً.`;
  }

  const lines = Object.entries(DAY_LABELS).map(([dayKey, label]) => {
    const slot = workingHours?.[dayKey];
    if (!slot?.start || !slot?.end) {
      return `- ${label}: مغلق`;
    }

    return `- ${label}: ${slot.start} إلى ${slot.end}`;
  });

  return `${heading}:\n${lines.join('\n')}`;
};

const formatBaseServicePrice = (service = {}) => {
  const from = service.priceFrom;
  const to = service.priceTo;

  if (from != null && to != null) return `من ${formatCurrency(from)} إلى ${formatCurrency(to)}`;
  if (from != null) return `يبدأ من ${formatCurrency(from)}`;
  if (to != null) return `حتى ${formatCurrency(to)}`;
  if (service.price != null) return formatCurrency(service.price);
  return '';
};

const formatServicePriceForPatient = async (service, patientId) => {
  if (service?.price == null) {
    return formatBaseServicePrice(service);
  }

  if (!patientId) {
    return formatCurrency(service.price);
  }

  const discount = await getDiscountForService({ patientId, service });
  if (!discount.discountAmount) {
    return formatCurrency(discount.amount);
  }

  const discountLabel = discount.rule?.name ? `عرض ${discount.rule.name}` : 'عرض خاص';
  const valueLabel =
    discount.rule?.type === 'PERCENT'
      ? `خصم ${Number(discount.rule.value).toLocaleString('ar-EG')}%`
      : `خصم ${formatCurrency(discount.discountAmount)}`;

  return `السعر بعد الخصم ${formatCurrency(discount.finalAmount)} بدلاً من ${formatCurrency(discount.amount)} (${discountLabel} - ${valueLabel})`;
};

const buildServicesText = async (services, patientId) => {
  if (!services.length) {
    return 'لا توجد خدمات منشورة حالياً.';
  }

  const lines = [];
  for (const service of services.slice(0, 12)) {
    const name = service.nameAr || service.name || 'خدمة';
    const price = await formatServicePriceForPatient(service, patientId);
    lines.push(`- ${name}${price ? `: ${price}` : ''}`);
  }

  return `أسعار الخدمات المتاحة:\n${lines.join('\n')}`;
};

const buildDoctorsText = (doctors) => {
  if (!doctors.length) {
    return 'لا يوجد أطباء متاحون حالياً.';
  }

  return `الأطباء المتاحون:\n${doctors
    .slice(0, 12)
    .map((doctor) => `- ${doctor.name}${doctor.specialization ? ` (${doctor.specialization})` : ''}`)
    .join('\n')}`;
};

const buildDoctorsSchedulesText = (doctors) => {
  if (!doctors.length) {
    return 'لا توجد مواعيد أطباء متاحة حالياً.';
  }

  return `مواعيد الدكاترة:\n\n${doctors
    .map((doctor) => {
      const specialization = doctor.specialization ? ` - ${doctor.specialization}` : '';
      return formatWorkingHours(doctor.workingHours || {}, `مواعيد ${doctor.name}${specialization}`);
    })
    .join('\n\n')}`;
};

const findMatchingServices = (services, userText) => {
  const lookup = normalizeLookupText(userText);
  if (!lookup) return [];

  const genericTerms = new Set([
    'اسعار',
    'السعر',
    'سعر',
    'تكلفه',
    'تكلفة',
    'خدمه',
    'خدمة',
    'خدمات',
    'كل',
    'جلسه',
    'جلسة',
    'كامل',
    'كامله',
    'كاملة',
    'هاي',
    'هذا',
    'هذي',
    'شنو',
    'بكم',
    'كم',
    'لو',
  ]);

  return services.filter((service) => {
    const name = normalizeLookupText(service.nameAr || service.name || '');
    if (!name) return false;

    if (lookup.includes(name)) {
      return true;
    }

    const parts = name.split(' ').filter((part) => part.length > 2 && !genericTerms.has(part));
    if (!parts.length) return false;
    return parts.every((part) => lookup.includes(part));
  });
};

const buildSpecificServicesReply = async (services, patientId) => {
  if (!services.length) return '';

  const lines = [];
  for (const service of services.slice(0, 3)) {
    const serviceName = service.nameAr || service.name || 'خدمة';
    const price = await formatServicePriceForPatient(service, patientId);
    lines.push(`- ${serviceName}: ${price || 'يرجى مراجعة الاستقبال لتأكيد السعر'}`);
  }

  return [
    services.length === 1 ? 'بالنسبة للخدمة المطلوبة:' : 'بالنسبة للخدمات المطلوبة:',
    ...lines,
    'إذا كنت تقصد هل السعر كامل أو حسب عدد الجلسات، فالاستقبال يؤكد لك هذه التفاصيل بدقة.',
  ].join('\n');
};

const getRecentConversationHistory = async (patientId, platform) => {
  if (!patientId) return [];

  const messages = await prisma.message.findMany({
    where: {
      patientId,
      platform,
      type: { in: ['INBOUND', 'OUTBOUND'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 6,
  });

  return messages.reverse();
};

const buildAddressReply = (settings) => {
  const address = settings?.address || 'العنوان غير متاح حالياً.';
  const mapsLink = settings?.googleMapsLink || '';
  return mapsLink ? `عنوان العيادة:\n${address}\n\nرابط الموقع:\n${mapsLink}` : `عنوان العيادة:\n${address}`;
};

const buildInquiryMenuReply = () =>
  [
    'تقدر تستفسر عن أي شيء يخص العيادة.',
    '',
    'مثلاً يمكنك أن تسأل عن:',
    '- الأسعار',
    '- الخدمات المتاحة',
    '- عنوان العيادة',
    '- مواعيد العمل',
    '- مشكلة أو أعراض لديك',
  ].join('\n');

const buildDefaultReply = (clinicName) =>
  [
    `مرحباً بك في عيادة ${clinicName}.`,
    'اختر:',
    '- احجز',
    '- استفسار',
  ].join('\n');

const looksLikeRealQuestion = (text = '') => {
  const value = String(text || '').trim();
  if (!value) return false;
  if (GREETING_ONLY_PATTERN.test(value)) return false;

  return (
    value.includes('?') ||
    value.includes('؟') ||
    /(كم|بكم|شلون|شنو|ايش|إيش|ازاي|كيف|فين|وين|هاي|هذا|هذي|الحشوات|حشوة|تركيب|جلسة|جلسه|كامل|كاملة|كله|كله|السعر|سعر|تكلفة|خدمة|خدمات|عنوان|مكان|موقع)/i.test(
      value
    )
  );
};

const buildBookingReply = (settings) => {
  const whatsappLink = resolveWhatsAppChatLink({
    whatsappChatLink: settings?.whatsappChatLink,
    phone: settings?.phone,
  });

  return [
    'تمام، إذا تريد حجز موعد عندنا خيارين:',
    whatsappLink ? `- تواصل معنا مباشرة على واتساب:\n${whatsappLink}` : null,
    '- أو ابعت رقمك هنا وسيتواصل معك الاستقبال لتأكيد الحجز.',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildCallbackPrompt = (settings) => String(settings?.socialContactPrompt || '').trim() || DEFAULT_CALLBACK_PROMPT;

const appendCallbackPrompt = (replyText, settings, { skip = false } = {}) => {
  if (skip) return replyText;

  const prompt = buildCallbackPrompt(settings);
  if (!prompt || String(replyText || '').includes(prompt)) {
    return replyText;
  }

  return [String(replyText || '').trim(), prompt].filter(Boolean).join('\n\n');
};

const detectIntent = (text) => {
  if (!text) return 'default';

  if (isAcknowledgement(text)) return 'acknowledgement';
  if (/^(استفسار|استفسار عادي|استفسر|ابي استفسر|اريد استفسر|بس دا استفسر)$/i.test(text)) return 'inquiry_menu';
  if (/^(احجز|حجز)$/i.test(text)) return 'booking';
  if (/(اتصلوا|اتواصلوا|حد\s*يكلمني|حد\s*يتواصل|اكلم\s*الدعم|عاوز\s*رقم|عاوز\s*حد)/i.test(text)) return 'callback_request';
  if (/(عنوان|العنوان|لوكيشن|location|map|maps|google maps|موقع|الموقع|مكان|المكان|فين العيادة|العيادة فين|الموقع فين|فين الموقع|وين العيادة|العيادة وين|وين المكان|مكان العيادة)/i.test(text)) return 'address';
  if (/(استفسار|استفسر|مشكلة|الم|ألم|تورم|نزيف|حساسية|كسر|رائحة|شكوى)/i.test(text)) return 'problem_inquiry';
  if (/(احجز|حجز|موعد|appointment|book)/i.test(text)) return 'booking';
  if (/(اسعار|أسعار|سعر|تكلفة|الكشف|الخدمات|service|price|بكم|حشوات|الحشوات|حشوة|التركيب|تركيب|جلسة|جلسه|كاملة|كامل)/i.test(text)) return 'prices';
  if (/(عنوان|العنوان|لوكيشن|location|map|maps|google maps|موقع|مكان|فين|وين)/i.test(text)) return 'address';
  if (/(مواعيد\s*الدكاتره|مواعيد\s*الدكاترة|مواعيد\s*الأطباء|دوام\s*الدكاتره|دوام\s*الدكاترة|doctor schedules?)/i.test(text)) return 'doctor_schedules';
  if (/(مواعيد|ساعات|دوام|working|hours)/i.test(text)) return 'hours';
  if (/(دكتور|دكاترة|دكاتره|أطباء|اطباء|doctor)/i.test(text)) return 'doctors';
  if (/(مرحبا|أهلا|اهلا|السلام عليكم|سلام|هاي|hello|hi|hey|start)/i.test(text)) return 'greeting';
  return 'default';
};

const isMissingServicePriceRangeColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('price_from') || message.includes('price_to');
};

const fetchActiveServices = async () => {
  try {
    return await prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true, nameAr: true, price: true, priceFrom: true, priceTo: true },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    if (!isMissingServicePriceRangeColumnError(error)) throw error;

    const services = await prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true, nameAr: true, price: true },
      orderBy: { createdAt: 'asc' },
    });

    return services.map((service) => ({ ...service, priceFrom: null, priceTo: null }));
  }
};

const fetchClinicSettings = async () =>
  prisma.clinicSettings.findFirst({
    select: {
      id: true,
      clinicName: true,
      clinicNameAr: true,
      botName: true,
      phone: true,
      address: true,
      whatsappChatLink: true,
      googleMapsLink: true,
      locationImageUrl: true,
      socialContactPrompt: true,
      workingHours: true,
      aiEnabled: true,
    },
  });

const findOrCreateSocialPatient = async ({
  platform,
  senderId,
  fallbackName,
  manychatSubscriberId = '',
  manychatContactId = '',
}) => {
  const idField = platform === 'FACEBOOK' ? 'facebookId' : 'instagramId';

  let patient = await prisma.patient.findFirst({
    where: {
      OR: [{ [idField]: senderId }, { platform, phone: senderId }],
    },
  });

  if (patient) {
    const updates = {};

    if (patient[idField] !== senderId) updates[idField] = senderId;
    if (manychatSubscriberId && patient.manychatSubscriberId !== manychatSubscriberId) {
      updates.manychatSubscriberId = manychatSubscriberId;
    }
    if (manychatContactId && patient.manychatContactId !== manychatContactId) {
      updates.manychatContactId = manychatContactId;
    }
    if (patient.name !== fallbackName && (patient.name?.startsWith('مريض ') || isPlaceholderName(patient.name))) {
      updates.name = fallbackName;
    }

    if (Object.keys(updates).length > 0) {
      patient = await prisma.patient.update({
        where: { id: patient.id },
        data: updates,
      });
    }

    return patient;
  }

  return prisma.patient.create({
    data: {
      name: fallbackName,
      phone: senderId,
      platform,
      [idField]: senderId,
      ...(manychatSubscriberId ? { manychatSubscriberId } : {}),
      ...(manychatContactId ? { manychatContactId } : {}),
    },
  });
};

const persistSocialMessage = async ({ patientId, platform, content, type, metadata = null }) =>
  prisma.message.create({
    data: {
      patientId,
      platform,
      content,
      type,
      ...(metadata ? { metadata } : {}),
    },
  });

const createCallbackRequest = async ({
  patient,
  platform,
  senderId,
  fullName,
  phone,
  sourceType,
  requestMessage,
  rawBody,
}) => {
  const existing = await prisma.callbackRequest.findFirst({
    where: {
      phone,
      platform,
      status: 'NEW',
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  const request = await prisma.callbackRequest.create({
    data: {
      patientId: patient?.id || null,
      platform,
      senderId: senderId || null,
      name: fullName || patient?.displayName || patient?.name || null,
      phone,
      requestMessage: requestMessage || null,
      source: sourceType === 'comment' ? 'MANYCHAT_COMMENT' : 'MANYCHAT_CHAT',
      metadata: rawBody || null,
    },
  });

  await prisma.adminNotification
    .create({
      data: {
        title: 'طلب تواصل جديد',
        message: `${request.name || 'عميل'} طلب أن يتواصل معه الاستقبال على الرقم ${phone}`,
        type: 'HUMAN_REQUEST',
        link: '/callback-requests',
      },
    })
    .catch(() => null);

  return request;
};

const manychatWebhook = async (req, res) => {
  try {
    writeManyChatLog('incoming', {
      headers: {
        hasWebhookToken: !!req.headers['x-webhook-token'],
        userAgent: req.headers['user-agent'] || '',
      },
      body: req.body,
    });

    const expectedToken = process.env.MANYCHAT_WEBHOOK_TOKEN;
    if (!expectedToken) {
      writeManyChatLog('misconfigured', { reason: 'missing_webhook_token' });
      return res.status(500).json({ ok: false, error: 'server_misconfigured' });
    }

    const incomingToken = req.headers['x-webhook-token'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!timingSafeEqual(incomingToken, expectedToken)) {
      writeManyChatLog('unauthorized', { body: req.body });
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    const platform = normalizePlatform(req.body?.platform);
    const senderId = readSubscriberId(req.body);
    const manychatContactId = readManychatContactId(req.body);
    const fullName = readFullName(req.body);
    const sourceType = readSourceType(req.body);
    const commentMeta = readCommentMetadata(req.body);
    const incomingTextRaw = readIncomingText(req.body);
    const incomingText = normalizeText(incomingTextRaw);
    const fallbackName = fullName || (platform === 'FACEBOOK' ? 'مريض Facebook' : 'مريض Instagram');
    const sessionKey = senderId ? `${platform}:${senderId}` : '';

    const [settings, services, doctors, patient] = await Promise.all([
      fetchClinicSettings(),
      fetchActiveServices(),
      prisma.doctor.findMany({
        where: { active: true },
        select: { name: true, specialization: true, workingHours: true },
        orderBy: { createdAt: 'asc' },
      }),
      senderId
        ? findOrCreateSocialPatient({
            platform,
            senderId,
            fallbackName,
            manychatSubscriberId: senderId,
            manychatContactId,
          })
        : Promise.resolve(null),
    ]);

    const intent = detectIntent(incomingText);
    const clinicName = settings?.clinicNameAr || settings?.clinicName || 'العيادة';
    const extractedPhone = extractPhoneNumber(incomingTextRaw);
    const socialSession = sessionKey ? getSocialSession(sessionKey) : null;
    const recentHistory = patient ? await getRecentConversationHistory(patient.id, platform) : [];
    const matchedServices = findMatchingServices(services, incomingTextRaw);
    const awaitingPhone = Boolean(socialSession?.awaitingPhone);
    const canUseContextualAi =
      Boolean(recentHistory.length) && (isFollowUpMessage(incomingTextRaw) || socialSession?.mode === 'inquiry');

    let replyText = '';
    let imageUrl = null;
    let callbackSaved = false;

    if (sourceType === 'comment' && !incomingText) {
      replyText = buildDefaultReply(clinicName);
    } else if (intent === 'greeting') {
      replyText = buildDefaultReply(clinicName);
    } else if (intent === 'acknowledgement') {
      replyText = 'حياك، إذا عندك أي سؤال إضافي أنا حاضر.';
    } else if (intent === 'inquiry_menu') {
      replyText = buildInquiryMenuReply();
    } else if (intent === 'callback_request') {
      replyText = 'أكيد، ابعت رقمك هنا وسنسجل الطلب فوراً لكي يتواصل معك الاستقبال.';
    } else if (intent === 'booking') {
      replyText = buildBookingReply(settings);
    } else if (intent === 'prices') {
      replyText =
        matchedServices.length > 0
          ? await buildSpecificServicesReply(matchedServices, patient?.id || null)
          : await buildServicesText(services, patient?.id || null);
    } else if (intent === 'address') {
      replyText = buildAddressReply(settings);
      imageUrl = settings?.locationImageUrl || null;
    } else if (intent === 'hours') {
      replyText = formatWorkingHours(settings?.workingHours);
    } else if (intent === 'doctors') {
      replyText = buildDoctorsText(doctors);
    } else if (intent === 'doctor_schedules') {
      replyText = buildDoctorsSchedulesText(doctors);
    } else if (settings?.aiEnabled && incomingText && (intent !== 'default' || looksLikeRealQuestion(incomingTextRaw) || canUseContextualAi)) {
      replyText = await openaiService.getInquiryResponse(
        String(incomingTextRaw || '').trim(),
        recentHistory,
        patient?.id || null
      );
    } else {
      replyText = buildDefaultReply(clinicName);
    }

    if (extractedPhone && (intent === 'callback_request' || intent === 'booking' || awaitingPhone)) {
      await createCallbackRequest({
        patient,
        platform,
        senderId,
        fullName,
        phone: extractedPhone,
        sourceType,
        requestMessage: incomingTextRaw || null,
        rawBody: req.body,
      });
      callbackSaved = true;
      replyText = [
        replyText,
        `تم استلام رقمك ${extractedPhone} وسيتواصل معك الاستقبال في أقرب وقت.`,
      ]
        .filter(Boolean)
        .join('\n\n');
    }

    if (!replyText) {
      replyText = buildDefaultReply(clinicName);
    }

    replyText = appendCallbackPrompt(replyText, settings, {
      skip: callbackSaved || intent === 'callback_request' || intent === 'booking' || awaitingPhone,
    });

    if (sessionKey) {
      if (callbackSaved) {
        clearSocialSession(sessionKey);
      } else if (intent === 'booking' || intent === 'callback_request') {
        setSocialSession(sessionKey, {
          mode: 'callback',
          awaitingPhone: true,
          lastIntent: intent,
        });
      } else if (sourceType !== 'comment' && intent !== 'greeting' && intent !== 'acknowledgement') {
        setSocialSession(sessionKey, {
          mode: 'inquiry',
          awaitingPhone: false,
          lastIntent: intent === 'default' ? socialSession?.lastIntent || 'inquiry' : intent,
        });
      }
    }

    if (patient && (incomingTextRaw || sourceType === 'comment')) {
      const inboundContent = incomingTextRaw || 'تعليق جديد بدون نص واضح';
      const baseMetadata = {
        source: sourceType === 'comment' ? 'COMMENT' : 'MANYCHAT',
        sourceType,
        rawPlatform: req.body?.platform || '',
        subscriberId: senderId,
        fullName: fullName || null,
        intent,
        extractedPhone,
        ...(commentMeta.commentId ? { commentId: commentMeta.commentId } : {}),
        ...(commentMeta.postId ? { postId: commentMeta.postId } : {}),
        raw: req.body,
      };

      await persistSocialMessage({
        patientId: patient.id,
        platform,
        content: inboundContent,
        type: 'INBOUND',
        metadata: baseMetadata,
      });

      await persistSocialMessage({
        patientId: patient.id,
        platform,
        content: replyText,
        type: 'OUTBOUND',
        metadata: {
          ...baseMetadata,
          delivery: 'MANYCHAT_AUTOMATION',
          imageUrl,
          callbackSaved,
        },
      });
    }

    const publicImageUrl = toAbsoluteUrl(req, imageUrl);

    const autoSendReply = req.body?.auto_send_reply === true || req.body?.auto_send_reply === 'true';
    let autoSent = false;
    let autoSendError = null;

    if (autoSendReply && senderId) {
      try {
        if (publicImageUrl) {
          await manychatService.sendImage({
            subscriberId: senderId,
            platform,
            imageUrl: publicImageUrl,
          });
        }
        await manychatService.sendText({
          subscriberId: senderId,
          platform,
          text: replyText,
          quickReplies: [],
        });
        autoSent = true;
      } catch (error) {
        autoSendError = {
          status: error.response?.status || null,
          data: error.response?.data || null,
          message: error.message,
        };
        console.error('[ManyChat] Auto send failed:', autoSendError);
      }
    }

    writeManyChatLog('response', {
      intent,
      incomingText,
      incomingTextRaw,
      sourceType,
      platform,
      patientId: patient?.id || null,
      senderId: senderId || null,
      commentId: commentMeta.commentId || null,
      imageUrl: publicImageUrl,
      callbackSaved,
      autoSendReply,
      autoSent,
      autoSendError,
    });

    return res.json({
      ok: true,
      intent,
      reply_text: replyText,
      quick_replies: DEFAULT_QUICK_REPLIES,
      image_url: publicImageUrl,
      callback_saved: callbackSaved,
      callback_prompt: buildCallbackPrompt(settings),
      auto_sent: autoSent,
      auto_send_error: autoSendError,
    });
  } catch (error) {
    console.error('[ManyChat] Webhook error:', error.message);
    writeManyChatLog('error', {
      message: error.message,
      body: req.body,
    });
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      reply_text: 'حدث خطأ مؤقت. حاول مرة أخرى بعد قليل.',
      quick_replies: DEFAULT_QUICK_REPLIES,
    });
  }
};

module.exports = {
  manychatWebhook,
};
