const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const openaiService = require('../services/openaiService');
const { getDiscountForService } = require('../services/discountService');
const { formatCurrency } = require('../utils/helpers');
const { resolveWhatsAppChatLink } = require('../utils/clinicLinks');

const DEFAULT_QUICK_REPLIES = [
  'احجز موعد',
  'أسعار الخدمات',
  'عنوان العيادة',
  'مواعيد العمل',
  'الدكاترة',
  'عاوز حد يتواصل معايا',
];

const DAY_LABELS = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

const DEFAULT_CALLBACK_PROMPT = 'إذا تحب نخلي الاستقبال يتواصل وياك، ابعت رقمك هنا وسنتواصل معك.';
const manychatLogPath = path.join(process.cwd(), 'manychat-debug.log');
const PLATFORM_MAP = {
  facebook: 'FACEBOOK',
  instagram: 'INSTAGRAM',
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizePlatform = (value) => PLATFORM_MAP[String(value || '').trim().toLowerCase()] || 'FACEBOOK';
const isTemplatePlaceholder = (value) => /^\{\{[^}]+\}\}$/.test(String(value || '').trim());

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
    fs.appendFileSync(manychatLogPath, line, 'utf8');
  } catch (error) {
    console.error('[ManyChat] Failed to write debug log:', error.message);
  }
};

const timingSafeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
};

const readIncomingText = (body) =>
  pickFirstString(
    body?.message_text,
    body?.comment_text,
    body?.comment_message,
    body?.last_comment_text,
    body?.last_text_input,
    body?.text,
    body?.message,
    body?.input,
    body?.content,
    body?.comment?.text,
    body?.comment?.message,
    body?.data?.comment_text,
    body?.data?.text,
    body?.full_contact_data?.last_text_input
  );

const readSourceType = (body) => pickFirstString(body?.source_type, body?.trigger_type).toLowerCase() || 'chat';

const readSubscriberId = (body) =>
  pickFirstString(
    body?.subscriber_id,
    body?.contact_id,
    body?.user_id,
    body?.sender_id,
    body?.id,
    body?.full_contact_data?.contact_id
  );

const readManychatContactId = (body) =>
  pickFirstString(body?.contact_id, body?.full_contact_data?.contact_id);

const readFullName = (body) =>
  pickFirstString(
    body?.full_name,
    body?.name,
    [body?.first_name, body?.last_name].filter(Boolean).join(' '),
    body?.full_contact_data?.full_name
  );

const readCommentMetadata = (body) => ({
  commentId: pickFirstString(body?.comment_id, body?.commentId, body?.comment?.id, body?.data?.comment_id),
  postId: pickFirstString(body?.post_id, body?.postId, body?.media_id, body?.mediaId, body?.data?.post_id),
});

const isPlaceholderName = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return true;
  }

  return isTemplatePlaceholder(normalized) || normalized.toLowerCase() === 'full name';
};

const normalizeDigits = (value = '') =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[^\d+]/g, '');

const extractPhoneNumber = (value = '') => {
  const raw = String(value || '');
  const normalized = normalizeDigits(raw);
  const match = normalized.match(/(?:\+?\d){7,15}/);
  if (!match) {
    return null;
  }

  return match[0];
};

const formatWorkingHours = (workingHours = {}, heading = 'مواعيد العمل') => {
  if (!workingHours || typeof workingHours !== 'object') {
    return `${heading} غير متاحة حالياً.`;
  }

  const lines = Object.entries(DAY_LABELS)
    .map(([dayKey, label]) => {
      const slot = workingHours?.[dayKey];
      if (!slot?.start || !slot?.end) {
        return `- ${label}: مغلق`;
      }
      return `- ${label}: ${slot.start} إلى ${slot.end}`;
    })
    .filter(Boolean);

  if (!lines.length) {
    return `${heading} غير متاحة حالياً.`;
  }

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

  const lines = doctors.slice(0, 12).map((doctor) => {
    const specialization = doctor.specialization ? ` (${doctor.specialization})` : '';
    return `- ${doctor.name}${specialization}`;
  });

  return `الأطباء المتاحون:\n${lines.join('\n')}`;
};

const buildDoctorsSchedulesText = (doctors) => {
  if (!doctors.length) {
    return 'لا توجد مواعيد أطباء متاحة حالياً.';
  }

  const sections = doctors.map((doctor) => {
    const specialization = doctor.specialization ? ` - ${doctor.specialization}` : '';
    return formatWorkingHours(doctor.workingHours || {}, `مواعيد ${doctor.name}${specialization}`);
  });

  return `مواعيد الدكاترة:\n\n${sections.join('\n\n')}`;
};

const buildAddressReply = (settings) => {
  const address = settings?.address || 'العنوان غير متاح حالياً.';
  const mapsLink = settings?.googleMapsLink || '';
  if (mapsLink) {
    return `عنوان العيادة:\n${address}\n\nرابط الموقع:\n${mapsLink}`;
  }

  return `عنوان العيادة:\n${address}`;
};

const buildDefaultReply = (clinicName) =>
  `أهلاً بك في ${clinicName}.\nاكتب:\n- احجز موعد\n- أسعار الخدمات\n- عنوان العيادة\n- مواعيد العمل\n- الدكاترة\n- عاوز حد يتواصل معايا`;

const buildCallbackPrompt = (settings) =>
  String(settings?.socialContactPrompt || '').trim() || DEFAULT_CALLBACK_PROMPT;

const appendCallbackPrompt = (replyText, settings, { skip = false } = {}) => {
  if (skip) {
    return replyText;
  }

  const prompt = buildCallbackPrompt(settings);
  if (!prompt) {
    return replyText;
  }

  if (String(replyText || '').includes(prompt)) {
    return replyText;
  }

  return [String(replyText || '').trim(), prompt].filter(Boolean).join('\n\n');
};

const detectIntent = (text) => {
  if (!text) {
    return 'default';
  }

  if (/(اتصلوا|اتواصلوا|حد\s*يكلمني|حد\s*يتواصل|اكلم\s*الدعم|عاوز\s*رقم|عاوز\s*حد)/i.test(text)) {
    return 'callback_request';
  }
  if (/(استفسار|مشكلة|الم|ألم|تورم|نزيف|حساسية|كسر|رائحة|شكوى)/i.test(text)) {
    return 'problem_inquiry';
  }
  if (/(احجز|حجز|موعد|appointment|book)/i.test(text)) {
    return 'booking';
  }
  if (/(اسعار|أسعار|سعر|تكلفة|الكشف|الخدمات|service|price)/i.test(text)) {
    return 'prices';
  }
  if (/(عنوان|العنوان|لوكيشن|location|map|maps|google maps)/i.test(text)) {
    return 'address';
  }
  if (/(مواعيد\s*الدكاتره|مواعيد\s*الدكاترة|مواعيد\s*الأطباء|دوام\s*الدكاتره|دوام\s*الدكاترة|doctor schedules?)/i.test(text)) {
    return 'doctor_schedules';
  }
  if (/(مواعيد|ساعات|دوام|working|hours)/i.test(text)) {
    return 'hours';
  }
  if (/(دكتور|دكاترة|دكاتره|أطباء|اطباء|doctor)/i.test(text)) {
    return 'doctors';
  }
  if (/(مرحبا|أهلا|اهلا|السلام عليكم|سلام|هاي|hello|hi|hey|start)/i.test(text)) {
    return 'greeting';
  }

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
      select: {
        id: true,
        name: true,
        nameAr: true,
        price: true,
        priceFrom: true,
        priceTo: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    if (!isMissingServicePriceRangeColumnError(error)) {
      throw error;
    }

    const services = await prisma.service.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        price: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return services.map((service) => ({
      ...service,
      priceFrom: null,
      priceTo: null,
    }));
  }
};

const fetchClinicSettings = async () => {
  return prisma.clinicSettings.findFirst({
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
};

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

    if (patient[idField] !== senderId) {
      updates[idField] = senderId;
    }

    if (manychatSubscriberId && patient.manychatSubscriberId !== manychatSubscriberId) {
      updates.manychatSubscriberId = manychatSubscriberId;
    }

    if (manychatContactId && patient.manychatContactId !== manychatContactId) {
      updates.manychatContactId = manychatContactId;
    }

    if (
      patient.name !== fallbackName &&
      (patient.name?.startsWith('مريض ') || isPlaceholderName(patient.name))
    ) {
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
      status: { in: ['NEW', 'CONTACTED'] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return existing;
  }

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

  await prisma.adminNotification.create({
    data: {
      title: 'طلب تواصل جديد',
      message: `${request.name || 'عميل'} طلب أن يتواصل معه الاستقبال على الرقم ${phone}`,
      type: 'HUMAN_REQUEST',
      link: '/callback-requests',
    },
  }).catch(() => null);

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
      console.error('[ManyChat] MANYCHAT_WEBHOOK_TOKEN is not configured');
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
    const fallbackName = fullName || (platform === 'FACEBOOK' ? 'مريض Facebook' : 'مريض Instagram');

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

    const incomingTextRaw = readIncomingText(req.body);
    const incomingText = normalizeText(incomingTextRaw);
    const intent = detectIntent(incomingText);
    const clinicName = settings?.clinicNameAr || settings?.clinicName || 'العيادة';
    const whatsappLink = resolveWhatsAppChatLink({
      whatsappChatLink: settings?.whatsappChatLink,
      phone: settings?.phone,
    });
    const extractedPhone = extractPhoneNumber(incomingTextRaw);

    let replyText = '';
    let imageUrl = null;
    let callbackSaved = false;

    if (intent === 'greeting') {
      replyText = buildDefaultReply(clinicName);
    } else if (intent === 'callback_request') {
      replyText = 'أكيد، ابعت رقمك هنا وسنسجل الطلب فوراً لكي يتواصل معك الاستقبال.';
    } else if (intent === 'problem_inquiry') {
      replyText = await openaiService.getInquiryResponse(String(incomingTextRaw || '').trim(), [], patient?.id || null);
    } else if (intent === 'booking') {
      replyText = whatsappLink
        ? `تمام، للحجز المباشر تواصل معنا عبر الرابط:\n${whatsappLink}`
        : `تمام، اكتب اسم الخدمة أو الدكتور المناسب لك وسنسجل طلبك ثم يتابع معك الفريق.`;
    } else if (intent === 'prices') {
      replyText = await buildServicesText(services, patient?.id || null);
    } else if (intent === 'address') {
      replyText = buildAddressReply(settings);
      imageUrl = settings?.locationImageUrl || null;
    } else if (intent === 'hours') {
      replyText = formatWorkingHours(settings?.workingHours);
    } else if (intent === 'doctors') {
      replyText = buildDoctorsText(doctors);
    } else if (intent === 'doctor_schedules') {
      replyText = buildDoctorsSchedulesText(doctors);
    } else if (settings?.aiEnabled && incomingText) {
      replyText = await openaiService.getInquiryResponse(String(incomingTextRaw || '').trim(), [], patient?.id || null);
    } else {
      replyText = buildDefaultReply(clinicName);
    }

    if (extractedPhone) {
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
      skip: callbackSaved || intent === 'callback_request',
    });

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

    writeManyChatLog('response', {
      intent,
      incomingText,
      replyText,
      sourceType,
      platform: req.body?.platform || '',
      patientId: patient?.id || null,
      senderId: senderId || null,
      commentId: commentMeta.commentId || null,
      imageUrl,
      callbackSaved,
    });

    return res.json({
      ok: true,
      intent,
      reply_text: replyText,
      quick_replies: DEFAULT_QUICK_REPLIES,
      image_url: imageUrl,
      callback_saved: callbackSaved,
      callback_prompt: buildCallbackPrompt(settings),
      meta: {
        clinic_name: clinicName,
        has_whatsapp_link: !!whatsappLink,
        has_google_maps_link: !!settings?.googleMapsLink,
      },
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
