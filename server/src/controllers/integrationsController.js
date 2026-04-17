const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const openaiService = require('../services/openaiService');

const DEFAULT_QUICK_REPLIES = [
  'احجز موعد',
  'أسعار الخدمات',
  'عنوان العيادة',
  'مواعيد العمل',
  'مواعيد الدكاتره',
  'استفسار سريع عن مشكلة',
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

const manychatLogPath = path.join(process.cwd(), 'manychat-debug.log');
const PLATFORM_MAP = {
  facebook: 'FACEBOOK',
  instagram: 'INSTAGRAM',
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizePlatform = (value) => PLATFORM_MAP[String(value || '').trim().toLowerCase()] || 'FACEBOOK';

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
  body?.message_text ||
  body?.last_text_input ||
  body?.text ||
  body?.message ||
  body?.input ||
  '';

const findOrCreateSocialPatient = async ({ platform, senderId, fallbackName }) => {
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

    if (patient.name !== fallbackName && patient.name?.startsWith('مريض ')) {
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

const formatCurrency = (value) => {
  if (typeof value !== 'number') {
    return 'غير محدد';
  }
  return `${value} ريال`;
};

const formatWorkingHours = (workingHours = {}, heading = 'مواعيد العمل') => {
  if (!workingHours || typeof workingHours !== 'object') {
    return `${heading} غير متاحة الآن.`;
  }

  const lines = Object.entries(DAY_LABELS)
    .map(([dayKey, label]) => {
      const slot = workingHours?.[dayKey];
      if (!slot?.start || !slot?.end) {
        return null;
      }
      return `- ${label}: ${slot.start} - ${slot.end}`;
    })
    .filter(Boolean);

  if (!lines.length) {
    return `${heading} غير متاحة الآن.`;
  }

  return `${heading}:\n${lines.join('\n')}`;
};

const buildServicesText = (services) => {
  if (!services.length) {
    return 'لا توجد خدمات منشورة حالياً.';
  }

  const lines = services.slice(0, 12).map((service) => {
    const name = service.nameAr || service.name || 'خدمة';
    return `- ${name}: ${formatCurrency(service.price)}`;
  });

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
    const schedule = formatWorkingHours(doctor.workingHours || {}, `مواعيد ${doctor.name}${specialization}`);
    return schedule;
  });

  return `مواعيد الدكاترة:\n\n${sections.join('\n\n')}`;
};

const detectIntent = (text) => {
  if (!text) {
    return 'default';
  }

  if (/(مرحبا|أهلا|اهلا|السلام عليكم|سلام|هاي|hello|hi|hey|start)/i.test(text)) {
    return 'greeting';
  }
  if (/(استفسار سريع عن مشكلة|عندي مشكلة بالاسنان|عندي مشكلة بالأسنان|عندي مشكلة|عندي ألم|اعاني من مشكلة|أعاني من مشكلة|استشارة سريعة|شكوى)/i.test(text)) {
    return 'problem_inquiry';
  }
  if (/(احجز|حجز|موعد|appointment|book)/i.test(text)) {
    return 'booking';
  }
  if (/(اسعار|أسعار|سعر|تكلفة|الكشف|الخدمات|service|price)/i.test(text)) {
    return 'prices';
  }
  if (/(عنوان|العنوان|لوكيشن|location|map|maps|خرائط|google maps)/i.test(text)) {
    return 'address';
  }
  if (/(مواعيد الدكاتره|مواعيد الدكاترة|مواعيد الأطباء|دوام الدكاتره|دوام الدكاترة|doctor schedules?)/i.test(text)) {
    return 'doctor_schedules';
  }
  if (/(مواعيد|ساعات|دوام|working|hours)/i.test(text)) {
    return 'hours';
  }
  if (/(دكتور|دكاترة|دكاتره|اطباء|أطباء|doctor)/i.test(text)) {
    return 'doctors';
  }

  return 'default';
};

const buildDefaultReply = (clinicName) =>
  `أهلاً بك في ${clinicName}.\nاكتب:\n- احجز موعد\n- أسعار الخدمات\n- عنوان العيادة\n- مواعيد العمل\n- مواعيد الدكاتره\n- استفسار سريع عن مشكلة`;

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
    const senderId = String(req.body?.subscriber_id || '').trim();
    const fullName = String(req.body?.full_name || '').trim();
    const fallbackName = fullName || (platform === 'FACEBOOK' ? 'مريض Facebook' : 'مريض Instagram');

    const [settings, services, doctors, patient] = await Promise.all([
      prisma.clinicSettings.findFirst(),
      prisma.service.findMany({
        where: { active: true },
        select: { name: true, nameAr: true, price: true },
        orderBy: { createdAt: 'asc' },
      }),
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
          })
        : Promise.resolve(null),
    ]);

    const incomingText = normalizeText(readIncomingText(req.body));
    const intent = detectIntent(incomingText);
    const clinicName = settings?.clinicNameAr || settings?.clinicName || 'العيادة';
    const whatsappLink = settings?.whatsappChatLink || '';
    const mapsLink = settings?.googleMapsLink || '';
    const address = settings?.address || 'العنوان غير متاح حالياً.';

    let replyText = '';

    if (intent === 'greeting') {
      replyText = buildDefaultReply(clinicName);
    } else if (intent === 'problem_inquiry') {
      replyText =
        'أكيد، اكتب لي المشكلة أو الأعراض باختصار، مثل: ألم، تورم، نزيف، حساسية، كسر، أو رائحة، وسأعطيك ردًا مبدئيًا مناسبًا.';
    } else if (intent === 'booking') {
      replyText = whatsappLink
        ? `تمام، للحجز مباشرة تواصل معنا عبر الرابط:\n${whatsappLink}`
        : `تمام، للحجز اكتب اسم الطبيب والخدمة واليوم المناسب لك، وفريق ${clinicName} سيتابع معك.`;
    } else if (intent === 'prices') {
      replyText = buildServicesText(services);
    } else if (intent === 'address') {
      replyText = mapsLink
        ? `عنوان العيادة:\n${address}\n\nرابط الموقع:\n${mapsLink}`
        : `عنوان العيادة:\n${address}`;
    } else if (intent === 'hours') {
      replyText = formatWorkingHours(settings?.workingHours);
    } else if (intent === 'doctors') {
      replyText = buildDoctorsText(doctors);
    } else if (intent === 'doctor_schedules') {
      replyText = buildDoctorsSchedulesText(doctors);
    } else if (settings?.aiEnabled && incomingText) {
      replyText = await openaiService.getInquiryResponse(incomingText, []);
    } else {
      replyText = buildDefaultReply(clinicName);
    }

    if (!replyText) {
      replyText = buildDefaultReply(clinicName);
    }

    if (patient && incomingText) {
      const baseMetadata = {
        source: 'MANYCHAT',
        sourceType: req.body?.source_type || 'chat',
        rawPlatform: req.body?.platform || '',
        subscriberId: senderId,
        fullName: fullName || null,
        intent,
      };

      await persistSocialMessage({
        patientId: patient.id,
        platform,
        content: readIncomingText(req.body),
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
        },
      });
    }

    writeManyChatLog('response', {
      intent,
      incomingText,
      replyText,
      sourceType: req.body?.source_type || '',
      platform: req.body?.platform || '',
      patientId: patient?.id || null,
    });

    return res.json({
      ok: true,
      intent,
      reply_text: replyText,
      quick_replies: DEFAULT_QUICK_REPLIES,
      meta: {
        clinic_name: clinicName,
        has_whatsapp_link: !!whatsappLink,
        has_google_maps_link: !!mapsLink,
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
