const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const config = require('../config/env');
const whatsappService = require('../services/whatsappService');
const messengerService = require('../services/messengerService');
const instagramService = require('../services/instagramService');
const openaiService = require('../services/openaiService');
const appointmentService = require('../services/appointmentService');
const { getDiscountForService } = require('../services/discountService');
const {
  buildWelcomeMessage,
  buildServiceSelection,
  buildDoctorSelection,
  buildDaySelection,
  buildPeriodSelection,
  buildTimeSlotSelection,
  buildPendingMessage,
  buildTextMessage,
  buildAppointmentsList,
  buildAppointmentOptions,
  buildCancelConfirmation,
  buildTextBookingConfirmation,
} = require('../utils/whatsappButtons');
const { generateTimeSlots, formatDateAr, formatTimeAr, formatCurrency, formatDateKey } = require('../utils/helpers');

// In-memory session store for booking flow (per phone number)
const bookingSessions = new Map();
const BOOKING_SESSION_TTL_MS = 30 * 60 * 1000;
const processedWhatsAppMessages = new Map();
const PROCESSED_WHATSAPP_MESSAGE_TTL_MS = 10 * 60 * 1000;
const TIME_SLOT_PAGE_SIZE = 9;
const ADDRESS_INTENT_PATTERN = /(عنوان|العنوان|الموقع|لوكيشن|location|map|maps|خرائط|جوجل\s*ماب|google\s*maps)/i;
const WHATSAPP_BOOKING_TEXT_PATTERN = /(?:حجز|موعد|احجز|حابه احجز|عاوز احجز|عايزة احجز|book|appointment)/i;
const WHATSAPP_INQUIRY_TEXT_PATTERN = /(?:استفسار|سؤال|اسال|اسأل|عاوز اسال|عايز اسال|عاوز أعرف|عايز أعرف|عاوزه اعرف|اريد الاستفسار)/i;
const WELCOME_GREETING_PATTERN = /مرحبا|سلام|السلام|أهلا|اهلا|هاي|hello|hi|start/i;
const RETURN_TO_MENU_PATTERN = /رجوع|عودة|القائمة|بداية|إلغاء|الغاء|cancel/i;
const WHATSAPP_INQUIRY_PROMPT =
  'تفضل، يمكنك الاستفسار عن الأسعار أو الخدمات أو عنوان العيادة أو المواعيد أو أي مشكلة لديك، وسأساعدك فوراً.';
const WHATSAPP_BOOKING_REQUEST_REPLY =
  'تم تسجيل رغبتك في الحجز، وسيتواصل معك موظف من الاستقبال لترتيب الموعد. إذا رغبت يمكننا أيضاً متابعة الحجز عبر نفس رقم الواتساب الحالي.';
const LEGACY_WHATSAPP_BOOKING_STEPS = new Set([
  'select_service',
  'text_booking_request',
  'select_doctor',
  'select_doctor_after_time',
  'select_day',
  'select_period',
  'select_time',
]);

const hasWorkingHours = (workingHours) =>
  Boolean(workingHours && typeof workingHours === 'object' && Object.values(workingHours).some(Boolean));

const createWhatsAppCallbackRequest = async (patient, requestMessage) => {
  const phone = String(patient?.phone || '').trim();
  if (!phone) {
    return null;
  }

  const existing = await prisma.callbackRequest.findFirst({
    where: {
      phone,
      platform: 'WHATSAPP',
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
      platform: 'WHATSAPP',
      senderId: patient?.whatsappId || phone,
      name: patient?.displayName || patient?.name || null,
      phone,
      requestMessage: requestMessage || 'طلب حجز من واتساب',
      source: 'WHATSAPP_CHAT',
      metadata: {
        chatState: patient?.chatState || 'BOT',
      },
    },
  });

  await prisma.adminNotification.create({
    data: {
      title: 'طلب حجز من واتساب',
      message: `${request.name || 'عميل'} طلب أن يتواصل معه الاستقبال على الرقم ${phone}`,
      type: 'HUMAN_REQUEST',
      link: '/callback-requests',
    },
  }).catch(() => null);

  return request;
};

const isWhatsAppBookingFlowSelection = (selectedId = '') =>
  [
    'whatsapp_booking_request',
    'book_appointment',
    'cancel_text_booking',
    'confirm_text_booking',
    'service_',
    'doctor_',
    'day_',
    'more_days_',
    'period_',
    'more_slots_',
    'slot_',
    'alt_slot_',
    'resch_apt_',
  ].some((prefix) => selectedId === prefix || selectedId.startsWith(prefix));

const resolveDoctorWorkingHours = (doctor, clinicWorkingHours = {}) =>
  hasWorkingHours(doctor?.workingHours) ? doctor.workingHours : clinicWorkingHours || {};

const pruneBookingSessions = () => {
  const now = Date.now();
  for (const [key, session] of bookingSessions.entries()) {
    if (!session?.updatedAt || now - session.updatedAt > BOOKING_SESSION_TTL_MS) {
      bookingSessions.delete(key);
    }
  }
};

const getBookingSession = (key) => {
  pruneBookingSessions();
  const session = bookingSessions.get(key);
  if (!session) return null;
  if (Date.now() - session.updatedAt > BOOKING_SESSION_TTL_MS) {
    bookingSessions.delete(key);
    return null;
  }
  return session;
};

const setBookingSession = (key, data) => {
  bookingSessions.set(key, { ...data, updatedAt: Date.now() });
};

const clearBookingSession = (key) => {
  bookingSessions.delete(key);
};

const attachServiceDiscounts = async (services, patientId) =>
  Promise.all(
    services.map(async (service) => {
      const discount = await getDiscountForService({ patientId, service });
      if (!discount.discountAmount) {
        return service;
      }
      return {
        ...service,
        basePriceAmount: Number(discount.amount || service.price || 0),
        discountedPriceAmount: Number(discount.finalAmount || 0),
        activeDiscountValue: Number(discount.discountAmount || 0),
        whatsappPriceDescription: `بعد الخصم ${formatCurrency(discount.finalAmount)} بدل ${formatCurrency(discount.amount)}`,
      };
    })
  );

const formatServicePriceLabel = (service = {}) => {
  const from = service.priceFrom;
  const to = service.priceTo;

  if (from != null && to != null) {
    return `من ${formatCurrency(from)} إلى ${formatCurrency(to)}`;
  }
  if (from != null) {
    return `يبدأ من ${formatCurrency(from)}`;
  }
  if (to != null) {
    return `حتى ${formatCurrency(to)}`;
  }
  if (service.price != null) {
    return formatCurrency(service.price);
  }

  return '';
};
const hasProcessedWhatsAppMessage = (messageId) => {
  if (!messageId) {
    return false;
  }

  const now = Date.now();
  for (const [id, timestamp] of processedWhatsAppMessages.entries()) {
    if (now - timestamp > PROCESSED_WHATSAPP_MESSAGE_TTL_MS) {
      processedWhatsAppMessages.delete(id);
    }
  }

  if (processedWhatsAppMessages.has(messageId)) {
    return true;
  }

  processedWhatsAppMessages.set(messageId, now);
  return false;
};
const webhookDebugLogPath = path.join(process.cwd(), 'webhook-debug.log');
const SOCIAL_BOOKING_PATTERN = /(?:\u062d\u062c\u0632|\u0645\u0648\u0639\u062f|\u0627\u062d\u062c\u0632|book|appointment|BOOK_APPOINTMENT)/i;
const MESSENGER_FALLBACK_NAME = '\u0645\u0631\u064a\u0636 Facebook';
const INSTAGRAM_FALLBACK_NAME = '\u0645\u0631\u064a\u0636 Instagram';
const SOCIAL_QUICK_REPLIES = [
  {
    title: '\u0627\u062d\u062c\u0632 \u0645\u0648\u0639\u062f',
    payload: 'BOOK_APPOINTMENT',
  },
  {
    title: '\u0627\u0644\u062e\u062f\u0645\u0627\u062a',
    payload: '\u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629',
  },
  {
    title: '\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u062f\u0643\u0627\u062a\u0631\u0647',
    payload: '\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u062f\u0643\u0627\u062a\u0631\u0647',
  },
  {
    title: '\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0643\u0634\u0641',
    payload: '\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0643\u0634\u0641 \u0628\u0627\u0644\u0639\u064a\u0627\u062f\u0629',
  },
  {
    title: '\u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0639\u0645\u0644',
    payload: '\u0645\u0627 \u0647\u064a \u0645\u0648\u0627\u0639\u064a\u062f \u0627\u0644\u0639\u0645\u0644\u061f',
  },
  {
    title: '\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u064a\u0627\u062f\u0629',
    payload: '\u0645\u0627 \u0647\u0648 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u064a\u0627\u062f\u0629\u061f',
  },
];
const SOCIAL_FALLBACK_REPLY = '\u0634\u0643\u0631\u0627\u064b \u0644\u062a\u0648\u0627\u0635\u0644\u0643! \u0633\u064a\u062a\u0645 \u0627\u0644\u0631\u062f \u0639\u0644\u064a\u0643 \u0642\u0631\u064a\u0628\u064b\u0627.';
const FACEBOOK_COMMENT_DM_FOLLOWUP =
  '\u0645\u0631\u062d\u0628\u0627\u064b! \u0644\u0642\u062f \u0642\u0645\u0646\u0627 \u0628\u0627\u0644\u0631\u062f \u0639\u0644\u0649 \u062a\u0639\u0644\u064a\u0642\u0643. \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627 \u0647\u0646\u0627 \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0628\u0631 \u0627\u0644\u0631\u0633\u0627\u0626\u0644 \u0644\u062d\u062c\u0632 \u0645\u0648\u0639\u062f\u0643 \u0623\u0648 \u0644\u0644\u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0646 \u0623\u064a \u062a\u0641\u0627\u0635\u064a\u0644.';

const writeWebhookDebugLog = (label, payload) => {
  try {
    const line = `[${new Date().toISOString()}] ${label} ${JSON.stringify(payload)}${'\n'}`;
    fs.appendFileSync(webhookDebugLogPath, line, 'utf8');
  } catch (error) {
    console.error('[Webhook Debug] Failed to write log:', error.message);
  }
};

const getRelatedDoctorIdsForPatient = async (patientId) => {
  const [appointments, consultations, prescriptions] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId },
      select: { doctorId: true },
      distinct: ['doctorId'],
    }),
    prisma.consultation.findMany({
      where: { patientId, doctorId: { not: null } },
      select: { doctorId: true },
      distinct: ['doctorId'],
    }),
    prisma.prescription.findMany({
      where: { patientId },
      select: { doctorId: true },
      distinct: ['doctorId'],
    }),
  ]);

  return [...new Set([...appointments, ...consultations, ...prescriptions].map((item) => item.doctorId).filter(Boolean))];
};

const getMessengerEventPayload = (event) => {
  if (event.postback) {
    const title = event.postback.title || '';
    const payload = event.postback.payload || '';
    const merged = [title, payload].filter(Boolean).join(' ').trim();
    return {
      displayContent: title || payload || '[postback]',
      routeContent: merged,
      metadataType: 'postback',
    };
  }

  const message = event.message || {};
  if (message.quick_reply?.payload) {
    const title = message.text || '';
    const payload = message.quick_reply.payload;
    return {
      displayContent: title || payload,
      routeContent: [title, payload].filter(Boolean).join(' ').trim(),
      metadataType: 'quick_reply',
    };
  }

  if (message.text) {
    return {
      displayContent: message.text,
      routeContent: message.text,
      metadataType: 'text',
    };
  }

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const attachmentTypes = message.attachments.map((attachment) => attachment.type || 'file').join(',');
    const placeholder = `[attachment:${attachmentTypes}]`;
    return {
      displayContent: placeholder,
      routeContent: placeholder,
      metadataType: 'attachment',
    };
  }

  return {
    displayContent: '',
    routeContent: '',
    metadataType: 'unknown',
  };
};

const getInstagramEventPayload = (event) => {
  const message = event.message || {};

  if (message.quick_reply?.payload) {
    const title = message.text || '';
    const payload = message.quick_reply.payload;
    return {
      displayContent: title || payload,
      routeContent: [title, payload].filter(Boolean).join(' ').trim(),
      metadataType: 'quick_reply',
    };
  }

  if (message.text) {
    return {
      displayContent: message.text,
      routeContent: message.text,
      metadataType: 'text',
    };
  }

  if (Array.isArray(message.attachments) && message.attachments.length > 0) {
    const attachmentTypes = message.attachments.map((attachment) => attachment.type || 'file').join(',');
    const placeholder = `[attachment:${attachmentTypes}]`;
    return {
      displayContent: placeholder,
      routeContent: placeholder,
      metadataType: 'attachment',
    };
  }

  return {
    displayContent: '',
    routeContent: '',
    metadataType: 'unknown',
  };
};

const findOrCreateSocialPatient = async ({ platform, senderId, fallbackName }) => {
  const idField = platform === 'FACEBOOK' ? 'facebookId' : 'instagramId';

  let patient = await prisma.patient.findFirst({
    where: {
      OR: [
        { [idField]: senderId },
        { platform, phone: senderId },
        { platform, whatsappId: senderId },
      ],
    },
  });

  if (patient) {
    const updates = {};

    if (patient[idField] !== senderId) {
      updates[idField] = senderId;
    }

    if (patient.platform === platform && patient.whatsappId === senderId) {
      updates.whatsappId = null;
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

const CONTACT_REQUEST_PATTERN = /(اتصل|تواصل|رقم|ارقام|أرقام|phone|contact|call)/i;

const buildDirectContactsMessage = async () => {
  const contacts = await prisma.directContact.findMany({
    where: { active: true },
    orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    take: 10,
  });

  if (!contacts.length) {
    return null;
  }

  return [
    'أرقام التواصل المباشر:',
    ...contacts.map((contact) => {
      const description = contact.description ? ` - ${contact.description}` : '';
      return `${contact.name}: ${contact.phone}${description}`;
    }),
  ].join('\n');
};

const verifyWebhookSignature = (req, appSecret, label) => {
  if (!appSecret || !req.rawBody) {
    if (config.nodeEnv === 'production') {
      console.error(`[${label}] Webhook signature cannot be verified: missing app secret or raw body`);
      return false;
    }
    return true;
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature) {
    console.log(`[${label}] Missing webhook signature`);
    writeWebhookDebugLog(`${label} signature_missing`, {});
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex')}`;

  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) {
    console.log(`[${label}] Invalid webhook signature`);
    writeWebhookDebugLog(`${label} signature_invalid_length`, {
      providedLength: provided.length,
      expectedLength: expected.length,
    });
    return false;
  }

  const isValid = crypto.timingSafeEqual(provided, expected);
  if (!isValid) {
    console.log(`[${label}] Invalid webhook signature`);
    writeWebhookDebugLog(`${label} signature_invalid`, {});
  }

  return isValid;
};

// ===================== WHATSAPP =====================

const whatsappVerifyHandler = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('[WhatsApp] Verify request received');

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    console.log('[WhatsApp] Webhook verified successfully');
    return res.status(200).send(challenge);
  }

  console.log('[WhatsApp] Verification failed');
  return res.sendStatus(403);
};

const whatsappWebhook = async (req, res) => {
  try {
    if (!verifyWebhookSignature(req, config.facebook.appSecret, 'WhatsApp')) {
      return res.sendStatus(403);
    }

    const originalBody = req.body;
    req.body = {
      object: originalBody?.object,
      entryCount: Array.isArray(originalBody?.entry) ? originalBody.entry.length : 0,
    };
    console.log('[WhatsApp] ًں“© Incoming webhook POST:', JSON.stringify(req.body, null, 2));
    // Always respond 200 immediately
    res.sendStatus(200);

    req.body = originalBody;
    const body = req.body;
    if (!body.entry) {
      console.log('[WhatsApp] No entry in body, ignoring');
      return;
    }

    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value.messages) {
          console.log('[WhatsApp] No messages in change value (status update or other)');
          continue;
        }

        console.log('[WhatsApp] Processing', value.messages.length, 'message(s)');
        for (const message of value.messages) {
          await handleWhatsAppMessage(message, value.contacts?.[0]);
        }
      }
    }
  } catch (error) {
    console.error('[WhatsApp] Webhook error:', error);
  }
};

const handleWhatsAppMessage = async (message, contact) => {
  const from = message.from;
  const messageId = message.id;

  try {
    if (hasProcessedWhatsAppMessage(messageId)) {
      console.log('[WhatsApp] Duplicate webhook message ignored:', messageId);
      return;
    }

    // Mark as read
    await whatsappService.markAsRead(messageId);

    // Find or create patient
    let isNewPatient = false;
    let patient = await prisma.patient.findFirst({ where: { phone: from } });
    if (!patient) {
      isNewPatient = true;
      patient = await prisma.patient.create({
        data: {
          name: contact?.profile?.name || 'مريض جديد',
          phone: from,
          platform: 'WHATSAPP',
          whatsappId: from,
        },
      });
    }

    // Determine message content
    let content = '';
    let buttonId = null;
    let listId = null;

    if (message.type === 'text') {
      content = message.text.body;
    } else if (message.type === 'interactive') {
      if (message.interactive.type === 'button_reply') {
        buttonId = message.interactive.button_reply.id;
        content = message.interactive.button_reply.title;
      } else if (message.interactive.type === 'list_reply') {
        listId = message.interactive.list_reply.id;
        content = message.interactive.list_reply.title;
      }
    } else if (message.type === 'button') {
      buttonId = message.button?.payload || '';
      content = message.button?.text || message.button?.payload || '';
    }

    // Save inbound message
    await prisma.message.create({
      data: {
        patientId: patient.id,
        platform: 'WHATSAPP',
        content: content || `[${message.type}]`,
        type: 'INBOUND',
        metadata: message,
      },
    });

    // Handle review rating buttons
    let ratingValue = null;
    if (buttonId && buttonId.startsWith('review_')) {
      const parsed = parseInt(buttonId.replace('review_', ''), 10);
      if ([1, 3, 5].includes(parsed)) {
        ratingValue = parsed;
      }
    }

    if (!ratingValue && content) {
      const normalized = content.trim();
      if (/ممتاز|excellent|رائع/i.test(normalized)) ratingValue = 5;
      else if (/جيد|good|متوسط/i.test(normalized)) ratingValue = 3;
      else if (/ضعيف|سيء|سيئ|poor|bad/i.test(normalized)) ratingValue = 1;
    }

    if (ratingValue) {
      const pendingReview = await prisma.review.findFirst({
        where: { patientId: patient.id, rating: null },
        orderBy: { sentAt: 'desc' },
      });

      if (pendingReview) {
        await prisma.review.update({
          where: { id: pendingReview.id },
          data: { rating: ratingValue, repliedAt: new Date() },
        });

        setBookingSession(from, { step: 'review_comment', reviewId: pendingReview.id, patientId: patient.id });

        const thankYouMsg = ratingValue >= 4
          ? 'شكراً جزيلاً لتقييمك الرائع! نسعد بخدمتك دائماً.\n\nهل تحب إضافة تعليق أو ملاحظات؟ (اكتبها أو أرسل “لا”)'
          : ratingValue >= 2
            ? 'شكراً لتقييمك! نعمل على تحسين خدماتنا باستمرار.\n\nهل تحب إضافة تعليق أو ملاحظات؟ (اكتبها أو أرسل “لا”)'
            : 'نأسف لعدم رضاك! رأيك مهم جداً لنا ونعمل على التحسين.\n\nهل تحب إضافة تعليق أو ملاحظات؟ (اكتبها أو أرسل “لا”)';

        return await whatsappService.sendTextMessage(from, thankYouMsg);
      }
    }

    // Handle review comment after rating
    const reviewSession = getBookingSession(from);
    if (reviewSession?.step === 'review_comment' && content) {
      const isSkip = /^(لا|no|skip|تخطي)$/i.test(content.trim());

      if (!isSkip) {
        await prisma.review.update({
          where: { id: reviewSession.reviewId },
          data: { comment: content.trim() },
        });
      }

      clearBookingSession(from);
      return await whatsappService.sendTextMessage(from, 'شكراً لوقتك! نتمنى لك دوام الصحة والعافية.');
    }

    // If human handover is active
    if (patient.chatState === 'HUMAN') {
      if (content && /رجوع|العودة|القائمة|بداية|إلغاء/i.test(content)) {
        // End human mode
        await prisma.patient.update({
          where: { id: patient.id },
          data: { chatState: 'BOT' }
        });
        return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
      }
      // Do not process booking/AI logic
      return;
    }

    if (content && CONTACT_REQUEST_PATTERN.test(content)) {
      const contactsMessage = await buildDirectContactsMessage();
      if (contactsMessage) {
        return await whatsappService.sendTextMessage(from, contactsMessage);
      }
    }

    // If this is a new patient and the first message is only a greeting, show the main menu.
    if (isNewPatient && message.type === 'text' && (!content || WELCOME_GREETING_PATTERN.test(content))) {
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    // Handle the booking flow
    const session = getBookingSession(from);

    // Selected ID from button or list
    const selectedId = buttonId || listId;

    // Main menu interactions
    if (selectedId === 'return_main') {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    if (isWhatsAppBookingFlowSelection(selectedId) || (session && LEGACY_WHATSAPP_BOOKING_STEPS.has(session.step))) {
      clearBookingSession(from);
      await createWhatsAppCallbackRequest(patient, content || 'طلب حجز من واتساب');
      return await whatsappService.sendTextMessage(from, WHATSAPP_BOOKING_REQUEST_REPLY);
    }

    if (selectedId === 'cancel_text_booking') {
      const session = getBookingSession(from);
      if (session?.serviceId) {
        session.step = 'text_booking_request';
        session.selectedTime = null;
        session.doctorId = null;
        setBookingSession(from, session);
        return await whatsappService.sendTextMessage(from, 'اكتب موعداً آخر بنفس الشكل:\nالخميس 9 مساءً 28/6');
      }
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    if (selectedId === 'confirm_text_booking') {
      const session = getBookingSession(from);
      if (!session?.serviceId || !session?.doctorId || !session?.selectedTime) {
        clearBookingSession(from);
        return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
      }
      return await handleTimeSlotSelection(from, patient, session.selectedTime);
    }

    if (selectedId === 'whatsapp_booking_request' || selectedId === 'book_appointment') {
      clearBookingSession(from);
      await createWhatsAppCallbackRequest(patient, 'طلب حجز من واتساب');
      return await whatsappService.sendTextMessage(from, WHATSAPP_BOOKING_REQUEST_REPLY);
    }

    if (selectedId === 'whatsapp_inquiry_mode') {
      setBookingSession(from, { step: 'whatsapp_inquiry', patientId: patient.id });
      return await whatsappService.sendTextMessage(from, WHATSAPP_INQUIRY_PROMPT);
    }

    if (selectedId === 'manage_bookings') {
      clearBookingSession(from);
      const activeAppointments = await prisma.appointment.findMany({
        where: {
          patientId: patient.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledTime: { gt: new Date() }
        },
        include: { service: true },
        orderBy: { scheduledTime: 'asc' },
      });

      if (activeAppointments.length === 0) {
        return await whatsappService.sendTextMessage(from, 'ليس لديك أي مواعيد قادمة حالياً. لحجز موعد جديد اختر "احجز موعد" من القائمة الرئيسية.');
      }

      return await whatsappService.sendInteractiveMessage(
        buildAppointmentsList(from, activeAppointments)
      );
    }

    // Handle appointment selection for management
    if (selectedId && selectedId.startsWith('manage_apt_')) {
      const aptId = selectedId.replace('manage_apt_', '');
      if (!aptId) return;

      const appointment = await prisma.appointment.findUnique({
        where: { id: aptId },
        include: { service: true, doctor: true }
      });

      if (!appointment || !['PENDING', 'CONFIRMED'].includes(appointment.status)) {
        return await whatsappService.sendTextMessage(from, 'عذراً، هذا الموعد غير متاح أو تم إلغاؤه مسبقاً.');
      }

      return await whatsappService.sendInteractiveMessage(
        buildAppointmentOptions(from, appointment)
      );
    }

    // Handle cancellation request
    if (selectedId && selectedId.startsWith('cancel_apt_')) {
      const aptId = selectedId.replace('cancel_apt_', '');
      return await whatsappService.sendInteractiveMessage(
        buildCancelConfirmation(from, aptId)
      );
    }

    // Handle cancellation confirmation
    if (selectedId && selectedId.startsWith('confirm_cancel_')) {
      const aptId = selectedId.replace('confirm_cancel_', '');

      const cancelledAppointment = await prisma.appointment.update({
        where: { id: aptId },
        data: { status: 'CANCELLED' },
        select: { id: true, doctorId: true },
      });

      // Notify Dashboard
      await prisma.adminNotification.create({
        data: {
          title: 'إلغاء حجز',
          message: `المريض ${patient.name} قام بإلغاء حجزه القادم.`,
          type: 'CANCELED_APPOINTMENT',
          link: `/appointments?doctorId=${cancelledAppointment.doctorId}&appointmentId=${cancelledAppointment.id}`
        }
      });

      return await whatsappService.sendTextMessage(from, 'تم إلغاء حجزك بنجاح.\nنتمنى لك دوام الصحة والعافية.');
    }

    // Handle rescheduling
    if (selectedId && selectedId.startsWith('resch_apt_')) {
      const aptId = selectedId.replace('resch_apt_', '');

      // Inject the appointment ID into the session so createAppointment updates it
      setBookingSession(from, { step: 'select_service', patientId: patient.id, rescheduleAptId: aptId });

      await whatsappService.sendTextMessage(from, 'حسناً، سيتم تأجيل موعدك الحالي. يرجى اختيار الخدمة والوقت الجديد:');

      // Start standard booking flow
      const services = await prisma.service.findMany({ where: { active: true } });
      const pricedServices = await attachServiceDiscounts(services, patient.id);
      return await whatsappService.sendTextMessage(from, buildServicesPrompt(pricedServices));
    }

    if (selectedId === 'inquiry') {
      setBookingSession(from, { step: 'whatsapp_inquiry', patientId: patient.id });
      return await whatsappService.sendTextMessage(from, WHATSAPP_INQUIRY_PROMPT);
    }

    if (selectedId === 'call_doctor') {
      const settings = await prisma.clinicSettings.findFirst();
      return await whatsappService.sendTextMessage(from, `للتواصل مع العيادة: ${settings?.phone || 'يرجى التواصل مع إدارة العيادة'}`);
    }

    if (selectedId === 'check_appointment') {
      setBookingSession(from, { step: 'check_appointment', patientId: patient.id });
      return await whatsappService.sendTextMessage(from, 'يرجى إرسال رقم الحجز المكوّن من 6 أحرف، مثال: BK-A1B2');
    }

    if (selectedId === 'request_reception') {
      await prisma.patient.update({
        where: { id: patient.id },
        data: { chatState: 'HUMAN' }
      });

      // Trigger Dashboard Notification
      await prisma.adminNotification.create({
        data: {
          title: 'طلب رد بشري',
          message: `المريض ${patient.name} يطلب التحدث مع موظف الاستقبال الآن.`,
          type: 'HUMAN_REQUEST',
          link: `/inbox?patientId=${patient.id}`,
        }
      });

      return await whatsappService.sendTextMessage(from, 'جارٍ تحويلك إلى موظف خدمة العملاء. تفضل بكتابة استفسارك، ولن يتم الرد عليك آلياً بعد الآن. للعودة إلى القائمة الرئيسية في أي وقت اكتب "رجوع".');
    }

    if (selectedId === 'request_consultation') {
      setBookingSession(from, { step: 'ask_consultation', patientId: patient.id });
      return await whatsappService.sendTextMessage(from, 'يرجى كتابة استشارتك أو الأعراض التي تعاني منها بالتفصيل في رسالة واحدة:');
    }

    // Service selection (in booking flow)
    if (listId && listId.startsWith('service_')) {
      const serviceId = listId.replace('service_', '');
      return await handleServiceSelection(from, patient, serviceId);
    }

    // Day selection
    if (listId && listId.startsWith('doctor_')) {
      const doctorId = listId.replace('doctor_', '');
      return await handleDoctorSelection(from, patient, doctorId);
    }

    if (listId && listId.startsWith('day_')) {
      const dateString = listId.replace('day_', '');
      return await handleDaySelection(from, patient, dateString);
    }

    if (listId && listId.startsWith('more_days_')) {
      const offset = Number(listId.replace('more_days_', '')) || 0;
      return await handleMoreDays(from, patient, offset);
    }

    // Period selection
    if (listId && listId.startsWith('period_')) {
      const parts = listId.split('_');
      const periodType = parts[1]; // morning, afternoon, evening
      const dateString = parts.slice(2).join('_');
      return await handlePeriodSelection(from, patient, periodType, dateString);
    }

    if (listId && listId.startsWith('more_slots_')) {
      const offset = Number(listId.replace('more_slots_', '')) || 0;
      return await handleMoreTimeSlots(from, patient, offset);
    }

    // Time slot selection (in booking flow)
    if (listId && (listId.startsWith('slot_') || listId.startsWith('alt_slot_'))) {
      const parts = listId.split('_');
      const timeISO = parts.slice(2).join('_');
      return await handleTimeSlotSelection(from, patient, timeISO);
    }

    // Handle greetings explicitly to show the Welcome Menu
    if (content && WELCOME_GREETING_PATTERN.test(content)) {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    if (session && content && RETURN_TO_MENU_PATTERN.test(content)) {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    // If in a session, handle session flow
    if (session) {
      return await handleSessionInput(from, patient, content, session);
    }

    // Text message keywords for returning patients
    if (content && WHATSAPP_BOOKING_TEXT_PATTERN.test(content)) {
      clearBookingSession(from);
      await createWhatsAppCallbackRequest(patient, content);
      return await whatsappService.sendTextMessage(from, WHATSAPP_BOOKING_REQUEST_REPLY);
    }

    if (content && WHATSAPP_INQUIRY_TEXT_PATTERN.test(content)) {
      setBookingSession(from, { step: 'whatsapp_inquiry', patientId: patient.id });
      return await whatsappService.sendTextMessage(from, WHATSAPP_INQUIRY_PROMPT);
    }

    // Default: Check if AI is enabled for general inquiries
    const settings = await prisma.clinicSettings.findFirst();
    if (settings?.aiEnabled && content) {
      return await handleInquiry(from, patient, content);
    }

    // Fallback: Send welcome message with buttons
    await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));

  } catch (error) {
    console.error('[WhatsApp] handleWhatsAppMessage ERROR:', error.message, error.stack);
    try {
      await whatsappService.sendTextMessage(from, 'عذراً، حدث خطأ تقني. يرجى المحاولة لاحقاً.');
    } catch (e) {
      // ignore send error
    }
  }
};

const getAvailableDaysForDoctor = async (doctor, service) => {
  const allDays = [];
  const clinicSettings = await prisma.clinicSettings.findFirst({
    select: { workingHours: true },
  });
  const workingHours = resolveDoctorWorkingHours(doctor, clinicSettings?.workingHours || {});

  for (let i = 0; i < SERVICE_DAY_LOOKAHEAD_DAYS; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        scheduledTime: { gte: dayStart, lte: dayEnd },
      },
    });

    const bookedTimes = bookedAppointments.map((appointment) => appointment.scheduledTime);
    const daySlots = generateTimeSlots(date, workingHours, service.duration, bookedTimes);

    if (daySlots.length > 0) {
      allDays.push({
        id: `day_${formatDateKey(date)}`,
        title: formatDateAr(date),
        description: `${doctor.name.replace('', '').replace('ط¯.', '').trim()}`,
      });
    }

    if (allDays.length >= MAX_AVAILABLE_DAYS_PER_DOCTOR) {
      break;
    }
  }

  return allDays;
};

const getAvailableDaysForService = async (service) => {
  const doctors = await prisma.doctor.findMany({ where: { active: true } });
  const daysByDate = new Map();

  for (const doctor of doctors) {
    const days = await getAvailableDaysForDoctor(doctor, service);
    days.forEach((day) => {
      const dateKey = day.id.replace('day_', '');
      const existing = daysByDate.get(dateKey) || {
        id: day.id,
        title: day.title,
        doctors: new Set(),
      };
      existing.doctors.add(doctor.name);
      daysByDate.set(dateKey, existing);
    });
  }

  return Array.from(daysByDate.values())
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((day) => ({
      id: day.id,
      title: day.title,
      description: `${day.doctors.size} طبيب متاح`,
    }));
};

const buildTimeSlotPage = (slots, offset = 0) => {
  const safeOffset = Math.max(0, Number(offset) || 0);
  const page = slots.slice(safeOffset, safeOffset + TIME_SLOT_PAGE_SIZE);
  const nextOffset = safeOffset + TIME_SLOT_PAGE_SIZE;

  if (slots.length > nextOffset) {
    page.push({
      id: `more_slots_${nextOffset}`,
      label: 'مواعيد أكثر',
      description: `عرض ${Math.min(TIME_SLOT_PAGE_SIZE, slots.length - nextOffset)} موعد إضافي`,
    });
  }

  return page;
};

const DAY_PAGE_SIZE = 9;
const SERVICE_DAY_LOOKAHEAD_DAYS = 30;
const MAX_AVAILABLE_DAYS_PER_DOCTOR = 21;

const normalizeDigits = (value = '') =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

const buildDayPage = (days, offset = 0) => {
  const safeOffset = Math.max(0, Number(offset) || 0);
  const page = days.slice(safeOffset, safeOffset + DAY_PAGE_SIZE);
  const nextOffset = safeOffset + DAY_PAGE_SIZE;

  if (days.length > nextOffset) {
    page.push({
      id: `more_days_${nextOffset}`,
      title: 'أيام أكثر',
      description: `عرض ${Math.min(DAY_PAGE_SIZE, days.length - nextOffset)} يوم إضافي`,
    });
  }

  return page;
};

const normalizeArabicText = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');

const buildServicesPrompt = (services = []) => {
  const priceValues = services
    .flatMap((service) => [
      Number(service.discountedPriceAmount ?? service.basePriceAmount ?? service.priceFrom ?? service.price ?? 0),
      Number(service.priceTo ?? service.discountedPriceAmount ?? service.basePriceAmount ?? service.price ?? 0),
    ])
    .filter((value) => Number.isFinite(value) && value > 0);
  const hasDiscount = services.some((service) => Number(service.activeDiscountValue || 0) > 0);

  const rangeLine =
    priceValues.length > 0
      ? `رينج الأسعار الحالي: من ${formatCurrency(Math.min(...priceValues))} إلى ${formatCurrency(Math.max(...priceValues))}.`
      : null;

  const lines = services.map((service, index) => {
    const serviceName = service.nameAr || service.name || `خدمة ${index + 1}`;
    const basePrice = Number(service.basePriceAmount ?? service.price ?? 0);
    const finalPrice = Number(service.discountedPriceAmount ?? service.price ?? 0);
    const hasServiceDiscount = Number(service.activeDiscountValue || 0) > 0 && finalPrice > 0;
    const price = hasServiceDiscount
      ? `السعر قبل الخصم ${formatCurrency(basePrice)}، وبعد الخصم ${formatCurrency(finalPrice)}`
      : service.whatsappPriceDescription || formatServicePriceLabel(service);

    return `${index + 1}. ${serviceName}${price ? ` - ${price}` : ''}`;
  });

  const introLines = ['الخدمات المتاحة للحجز:'];
  if (rangeLine) introLines.push(rangeLine);
  if (hasDiscount) introLines.push('يوجد خصم حالي، والأسعار المعروضة تحتوي السعر قبل الخصم وبعد الخصم.');

  return [...introLines, ...lines, '', 'اكتب رقم الخدمة المطلوبة من القائمة.'].join('\n');
};
const findServiceByText = (services = [], content = '') => {
  const normalizedInput = normalizeArabicText(normalizeDigits(content));
  if (!normalizedInput) return null;

  const exact = services.find((service) => {
    const names = [service.nameAr, service.name].filter(Boolean).map(normalizeArabicText);
    return names.includes(normalizedInput);
  });
  if (exact) return exact;

  const inclusive = services.find((service) => {
    const names = [service.nameAr, service.name].filter(Boolean).map(normalizeArabicText);
    return names.some((name) => name.includes(normalizedInput) || normalizedInput.includes(name));
  });

  return inclusive || null;
};

const ARABIC_DAY_NAMES = {
  'الاحد': 0,
  'الأحد': 0,
  'الاثنين': 1,
  'الاتنين': 1,
  'الإثنين': 1,
  'الثلاثاء': 2,
  'الاربعاء': 3,
  'الأربعاء': 3,
  'الخميس': 4,
  'الجمعة': 5,
  'الجمعه': 5,
  'السبت': 6,
};

const parseTextBookingRequest = (content) => {
  const text = String(content || '').trim();
  if (!text) return null;

  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  const timeMatch =
    text.match(/(\d{1,2})(?::(\d{2}))?\s*(ص|صباحا|صباحاً|am|a\.m\.|م|مساء|مساءً|pm|p\.m\.)/i) ||
    text.match(/(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return null;

  const now = new Date();
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  let year = dateMatch[3] ? Number(dateMatch[3]) : now.getFullYear();
  if (year < 100) year += 2000;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2] || 0);
  const period = String(timeMatch[3] || '').toLowerCase();
  if (/(م|pm|p\.m\.)/.test(period) && hour < 12) hour += 12;
  if (/(ص|am|a\.m\.)/.test(period) && hour === 12) hour = 0;

  let scheduledTime = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (!dateMatch[3] && scheduledTime < now) {
    scheduledTime = new Date(year + 1, month - 1, day, hour, minute, 0, 0);
  }

  const lowerText = text.toLowerCase();
  const mentionedDayEntry = Object.entries(ARABIC_DAY_NAMES).find(([name]) => lowerText.includes(name));
  const mentionedDay = mentionedDayEntry ? mentionedDayEntry[1] : null;

  return { scheduledTime, mentionedDay };
};

const sendTextBookingSummary = async (from, session, availability) => {
  const doctor = availability.doctors[0];
  session.doctorId = doctor.id;
  session.step = 'confirm_text_booking';
  setBookingSession(from, session);

  const scheduledTime = new Date(session.selectedTime);
  return whatsappService.sendInteractiveMessage(
    buildTextBookingConfirmation(from, {
      serviceName: availability.service.nameAr || availability.service.name,
      doctorName: doctor.name,
      dayLabel: formatDateAr(scheduledTime).split(' ')[0],
      dateLabel: formatDateAr(scheduledTime),
      timeLabel: formatTimeAr(scheduledTime),
    })
  );
};

const sendDoctorDaySelection = async (from, patient, service, doctor, availableDays = null) => {
  const allDays = availableDays || await getAvailableDaysForDoctor(doctor, service);
  if (allDays.length === 0) {
    return false;
  }

  const existingSession = getBookingSession(from) || {};
  setBookingSession(from, {
    ...existingSession,
    step: 'select_day',
    patientId: patient.id,
    serviceId: service.id,
    doctorId: doctor.id,
    availableDays: allDays,
    dayOffset: 0,
  });

  await whatsappService.sendInteractiveMessage(buildDaySelection(from, buildDayPage(allDays)));
  return true;
};

const startBookingFlow = async (from, patient) => {
  try {
    const services = await prisma.service.findMany({ where: { active: true } });

    if (services.length === 0) {
      return await whatsappService.sendTextMessage(from, 'عذراً، لا توجد خدمات متاحة حالياً.');
    }

    let pricedServices = services;
    try {
      pricedServices = await attachServiceDiscounts(services, patient.id);
    } catch (discountError) {
      console.error('[Booking] attachServiceDiscounts ERROR:', discountError.message);
    }

    setBookingSession(from, {
      step: 'select_service',
      patientId: patient.id,
      serviceOptions: pricedServices.map((service, index) => ({
        index: index + 1,
        id: service.id,
      })),
    });

    await whatsappService.sendTextMessage(from, buildServicesPrompt(pricedServices));
  } catch (error) {
    console.error('[Booking] startBookingFlow ERROR:', error.message, error.stack);
    return await whatsappService.sendTextMessage(from, 'عذراً، حدث خطأ أثناء بدء الحجز. يرجى المحاولة مرة أخرى.');
  }
};

const beginServiceDaySelection = async (from, patient, service, sessionOverrides = {}) => {
  const availableDays = await getAvailableDaysForService(service);
  if (availableDays.length === 0) {
    const services = await prisma.service.findMany({ where: { active: true } });
    const pricedServices = await attachServiceDiscounts(services, patient.id);
    setBookingSession(from, {
      ...sessionOverrides,
      step: 'select_service',
      patientId: patient.id,
      serviceOptions: pricedServices.map((option, index) => ({
        index: index + 1,
        id: option.id,
      })),
    });
    return await whatsappService.sendTextMessage(
      from,
      `عذراً، لا توجد مواعيد متاحة لهذه الخدمة حالياً.\nاختر رقم خدمة أخرى من القائمة:\n\n${buildServicesPrompt(pricedServices)}`
    );
  }

  const existingSession = getBookingSession(from) || {};
  setBookingSession(from, {
    ...existingSession,
    ...sessionOverrides,
    step: 'select_day',
    patientId: patient.id,
    serviceId: service.id,
    serviceDuration: service.duration,
    availableDays,
    dayOffset: 0,
  });

  return await whatsappService.sendInteractiveMessage(
    buildDaySelection(from, buildDayPage(availableDays))
  );
};

const handleServiceSelectionLegacy = async (from, patient, serviceId) => {
  try {
    console.log('[Booking] handleServiceSelection called:', { from, serviceId });

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      console.log('[Booking] Service not found:', serviceId);
      return await whatsappService.sendTextMessage(from, 'عذراً، الخدمة غير موجودة.');
    }

    const doctors = await prisma.doctor.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });

    if (doctors.length === 0) {
      clearBookingSession(from);
      return await whatsappService.sendTextMessage(from, 'عذراً، لا يوجد أطباء متاحون حالياً.');
    }

    const availableDoctors = (
      await Promise.all(
        doctors.map(async (doctor) => ({
          doctor,
          availableDays: await getAvailableDaysForDoctor(doctor, service),
        }))
      )
    ).filter((entry) => entry.availableDays.length > 0);

    if (availableDoctors.length === 0) {
      clearBookingSession(from);
      return await whatsappService.sendTextMessage(from, 'عذراً، لا توجد مواعيد متاحة حالياً. يرجى المحاولة لاحقاً.');
    }

    if (availableDoctors.length === 1) {
      const [entry] = availableDoctors;
      await sendDoctorDaySelection(from, patient, service, entry.doctor, entry.availableDays);
      return;
    }

    const existingSession = getBookingSession(from) || {};
    setBookingSession(from, {
      ...existingSession,
      step: 'select_doctor',
      patientId: patient.id,
      serviceId: service.id,
    });

    await whatsappService.sendInteractiveMessage(
      buildDoctorSelection(
        from,
        availableDoctors.map(({ doctor, availableDays }) => ({
          id: doctor.id,
          name: doctor.name,
          specialization: doctor.specialization,
          description: availableDays[0]
            ? `${doctor.specialization || 'طبيب'} - ${availableDays[0].title}`
            : doctor.specialization || 'طبيب',
        })),
        service.nameAr
      )
    );
  } catch (error) {
    console.error('[Booking] handleServiceSelection ERROR:', error.message, error.stack);
    clearBookingSession(from);
    await whatsappService.sendTextMessage(from, 'عذراً، حدث خطأ أثناء عرض المواعيد. يرجى المحاولة لاحقاً.');
  }
};

const handleServiceSelection = async (from, patient, serviceId) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      return await whatsappService.sendTextMessage(from, 'عذراً، الخدمة غير موجودة.');
    }

    return await beginServiceDaySelection(from, patient, service);
  } catch (error) {
    console.error('[Booking] handleServiceSelection ERROR:', error.message, error.stack);
    clearBookingSession(from);
    await whatsappService.sendTextMessage(from, 'عذراً، حدث خطأ أثناء عرض المواعيد. يرجى المحاولة لاحقاً.');
  }
};

const handleDoctorSelection = async (from, patient, doctorId) => {
  try {
    const session = getBookingSession(from);
    if (!session || !session.serviceId) {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    if (session.selectedTime) {
      const available = await appointmentService.isDoctorAvailableAt({
        doctorId,
        scheduledTime: session.selectedTime,
        duration: session.serviceDuration || 30,
      });

      if (!available) {
        await whatsappService.sendTextMessage(from, 'عذراً، هذا الطبيب لم يعد متاحاً في الوقت المختار. يرجى اختيار موعد آخر.');
        return await handleServiceSelection(from, patient, session.serviceId);
      }

      session.doctorId = doctorId;
      session.step = 'confirm_text_booking';
      setBookingSession(from, session);

      const [service, doctor] = await Promise.all([
        prisma.service.findUnique({ where: { id: session.serviceId } }),
        prisma.doctor.findUnique({ where: { id: doctorId } }),
      ]);
      const scheduledTime = new Date(session.selectedTime);
      return await whatsappService.sendInteractiveMessage(
        buildTextBookingConfirmation(from, {
          serviceName: service?.nameAr || service?.name || '-',
          doctorName: doctor?.name || '-',
          dayLabel: formatDateAr(scheduledTime).split(' ')[0],
          dateLabel: formatDateAr(scheduledTime),
          timeLabel: formatTimeAr(scheduledTime),
        })
      );
    }

    const [service, doctor] = await Promise.all([
      prisma.service.findUnique({ where: { id: session.serviceId } }),
      prisma.doctor.findFirst({ where: { id: doctorId, active: true } }),
    ]);

    if (!service || !doctor) {
      return await whatsappService.sendTextMessage(from, 'عذراً، هذا الطبيب غير متاح الآن.');
    }

    const didSendDays = await sendDoctorDaySelection(from, patient, service, doctor);
    if (!didSendDays) {
      await whatsappService.sendTextMessage(from, 'لا توجد مواعيد متاحة لهذا الطبيب الآن. سنعرض لك الأطباء المتاحين مرة أخرى.');
      return await handleServiceSelection(from, patient, session.serviceId);
    }
  } catch (error) {
    console.error('[Booking] handleDoctorSelection ERROR:', error.message);
    await whatsappService.sendTextMessage(from, 'حدث خطأ، يرجى المحاولة لاحقاً.');
  }
};

const handleDaySelectionLegacy = async (from, patient, dateString) => {
  try {
    const session = getBookingSession(from);
    if (!session || !session.serviceId || !session.doctorId) {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: session.doctorId } });
    const service = await prisma.service.findUnique({ where: { id: session.serviceId } });

    const targetDate = new Date(dateString);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        scheduledTime: { gte: dayStart, lte: dayEnd },
      },
    });

    const bookedTimes = bookedAppointments.map(a => a.scheduledTime);
    const daySlots = generateTimeSlots(targetDate, doctor.workingHours, service.duration, bookedTimes);

    if (daySlots.length === 0) {
      return await whatsappService.sendTextMessage(from, 'عذراً، لا توجد مواعيد متاحة في هذا اليوم. يرجى اختيار يوم آخر.');
    }

    // Update session
    session.step = 'select_period';
    session.selectedDate = dateString;
    setBookingSession(from, session);

    const periods = [];
    const hasMorning = daySlots.some(s => new Date(s.time).getHours() < 12);
    const hasAfternoon = daySlots.some(s => new Date(s.time).getHours() >= 12 && new Date(s.time).getHours() < 17);
    const hasEvening = daySlots.some(s => new Date(s.time).getHours() >= 17);

    const dateLabel = formatDateAr(targetDate);

    if (hasMorning) {
      periods.push({ id: `period_morning_${dateString}`, title: 'الصباح', description: 'قبل 12 ظهراً' });
    }
    if (hasAfternoon) {
      periods.push({ id: `period_afternoon_${dateString}`, title: 'الظهر والعصر', description: 'من 12 ظهراً إلى 5 عصراً' });
    }
    if (hasEvening) {
      periods.push({ id: `period_evening_${dateString}`, title: 'المساء', description: 'بعد 5 عصراً' });
    }

    const periodMessage = buildPeriodSelection(from, dateLabel, periods);
    await whatsappService.sendInteractiveMessage(periodMessage);
  } catch (error) {
    console.error('[Booking] handleDaySelection ERROR:', error.message);
    await whatsappService.sendTextMessage(from, 'حدث خطأ، يرجى المحاولة لاحقاً.');
  }
};

const handleDaySelection = async (from, patient, dateString) => {
  try {
    const session = getBookingSession(from);
    if (!session || !session.serviceId) {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    const service = await prisma.service.findUnique({ where: { id: session.serviceId } });
    const doctors = await prisma.doctor.findMany({ where: { active: true } });
    const clinicSettings = await prisma.clinicSettings.findFirst({
      select: { workingHours: true },
    });
    const clinicWorkingHours = clinicSettings?.workingHours || {};
    const targetDate = new Date(dateString);

    let daySlots = [];
    for (const doctor of doctors) {
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const bookedAppointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          status: { in: ['CONFIRMED', 'PENDING', 'BLOCKED'] },
          scheduledTime: { gte: dayStart, lte: dayEnd },
        },
        include: { service: true },
      });

      const bookedTimes = bookedAppointments.map((appointment) => ({
        start: appointment.scheduledTime,
        duration: appointment.service?.duration || service.duration,
      }));
      daySlots.push(
        ...generateTimeSlots(
          targetDate,
          resolveDoctorWorkingHours(doctor, clinicWorkingHours),
          service.duration,
          bookedTimes
        )
      );
    }

    const uniqueSlots = Array.from(new Map(daySlots.map((slot) => [slot.time, slot])).values())
      .sort((first, second) => new Date(first.time) - new Date(second.time));

    if (uniqueSlots.length === 0) {
      return await whatsappService.sendTextMessage(from, 'عذراً، لا توجد مواعيد متاحة في هذا اليوم. يرجى اختيار يوم آخر.');
    }

    session.step = 'select_period';
    session.selectedDate = dateString;
    session.serviceDuration = service.duration;
    setBookingSession(from, session);

    const periods = [];
    if (uniqueSlots.some((s) => new Date(s.time).getHours() < 12)) {
      periods.push({ id: `period_morning_${dateString}`, title: 'الصباح', description: 'قبل 12 ظهراً' });
    }
    if (uniqueSlots.some((s) => new Date(s.time).getHours() >= 12 && new Date(s.time).getHours() < 17)) {
      periods.push({ id: `period_afternoon_${dateString}`, title: 'الظهر والعصر', description: 'من 12 ظهراً إلى 5 عصراً' });
    }
    if (uniqueSlots.some((s) => new Date(s.time).getHours() >= 17)) {
      periods.push({ id: `period_evening_${dateString}`, title: 'المساء', description: 'بعد 5 عصراً' });
    }

    await whatsappService.sendInteractiveMessage(buildPeriodSelection(from, formatDateAr(targetDate), periods));
  } catch (error) {
    console.error('[Booking] handleDaySelection ERROR:', error.message);
    await whatsappService.sendTextMessage(from, 'حدث خطأ، يرجى المحاولة لاحقاً.');
  }
};

const handlePeriodSelectionLegacy = async (from, patient, periodType, dateString) => {
  try {
    const session = getBookingSession(from);
    if (!session || !session.serviceId || !session.doctorId) {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    const doctor = await prisma.doctor.findUnique({ where: { id: session.doctorId } });
    const service = await prisma.service.findUnique({ where: { id: session.serviceId } });

    const targetDate = new Date(dateString);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        scheduledTime: { gte: dayStart, lte: dayEnd },
      },
    });

    const bookedTimes = bookedAppointments.map(a => a.scheduledTime);
    const daySlots = generateTimeSlots(targetDate, doctor.workingHours, service.duration, bookedTimes);

    let filteredSlots = [];
    if (periodType === 'morning') {
      filteredSlots = daySlots.filter(s => new Date(s.time).getHours() < 12);
    } else if (periodType === 'afternoon') {
      filteredSlots = daySlots.filter(s => new Date(s.time).getHours() >= 12 && new Date(s.time).getHours() < 17);
    } else if (periodType === 'evening') {
      filteredSlots = daySlots.filter(s => new Date(s.time).getHours() >= 17);
    }

    if (filteredSlots.length === 0) {
      return await whatsappService.sendTextMessage(from, 'عذراً، لا توجد مواعيد متاحة في هذه الفترة. يرجى اختيار فترة أخرى.');
    }

    // Update session
    session.step = 'select_time';
    session.selectedPeriod = periodType;
    setBookingSession(from, session);

    // Show max 10 time slots for that period
    const displaySlots = filteredSlots.slice(0, 10);
    displaySlots.forEach(s => { s.doctor = doctor.name; });

    const slotMessage = buildTimeSlotSelection(from, displaySlots, formatDateAr(targetDate));
    await whatsappService.sendInteractiveMessage(slotMessage);
  } catch (error) {
    console.error('[Booking] handlePeriodSelection ERROR:', error.message);
    await whatsappService.sendTextMessage(from, 'حدث خطأ، يرجى المحاولة لاحقاً.');
  }
};

const handlePeriodSelection = async (from, patient, periodType, dateString) => {
  try {
    const session = getBookingSession(from);
    if (!session || !session.serviceId) {
      clearBookingSession(from);
      return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
    }

    const service = await prisma.service.findUnique({ where: { id: session.serviceId } });
    const doctors = await prisma.doctor.findMany({ where: { active: true } });
    const clinicSettings = await prisma.clinicSettings.findFirst({
      select: { workingHours: true },
    });
    const clinicWorkingHours = clinicSettings?.workingHours || {};
    const targetDate = new Date(dateString);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    let slots = [];
    for (const doctor of doctors) {
      const bookedAppointments = await prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          status: { in: ['CONFIRMED', 'PENDING', 'BLOCKED'] },
          scheduledTime: { gte: dayStart, lte: dayEnd },
        },
        include: { service: true },
      });
      const bookedTimes = bookedAppointments.map((appointment) => ({
        start: appointment.scheduledTime,
        duration: appointment.service?.duration || service.duration,
      }));
      slots.push(
        ...generateTimeSlots(
          targetDate,
          resolveDoctorWorkingHours(doctor, clinicWorkingHours),
          service.duration,
          bookedTimes
        )
      );
    }

    const uniqueSlots = Array.from(new Map(slots.map((slot) => [slot.time, slot])).values());
    const filteredSlots = uniqueSlots
      .filter((slot) => {
        const hour = new Date(slot.time).getHours();
        if (periodType === 'morning') return hour < 12;
        if (periodType === 'afternoon') return hour >= 12 && hour < 17;
        if (periodType === 'evening') return hour >= 17;
        return true;
      })
      .sort((first, second) => new Date(first.time) - new Date(second.time));

    if (filteredSlots.length === 0) {
      return await whatsappService.sendTextMessage(from, 'عذراً، لا توجد مواعيد متاحة في هذه الفترة. يرجى اختيار فترة أخرى.');
    }

    session.step = 'select_time';
    session.selectedPeriod = periodType;
    session.serviceDuration = service.duration;
    session.availableSlots = filteredSlots.map((slot) => ({ time: slot.time, label: slot.label }));
    session.slotOffset = 0;
    setBookingSession(from, session);

    await whatsappService.sendInteractiveMessage(buildTimeSlotSelection(from, buildTimeSlotPage(filteredSlots), formatDateAr(targetDate)));
  } catch (error) {
    console.error('[Booking] handlePeriodSelection ERROR:', error.message);
    await whatsappService.sendTextMessage(from, 'حدث خطأ، يرجى المحاولة لاحقاً.');
  }
};

const handleMoreDays = async (from, patient, offset) => {
  const session = getBookingSession(from);
  if (!session || !session.serviceId || !Array.isArray(session.availableDays)) {
    clearBookingSession(from);
    return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
  }

  const pageDays = buildDayPage(session.availableDays, offset);
  if (pageDays.length === 0) {
    return await whatsappService.sendTextMessage(from, 'لا توجد أيام إضافية متاحة حالياً.');
  }

  session.dayOffset = offset;
  setBookingSession(from, session);

  return await whatsappService.sendInteractiveMessage(buildDaySelection(from, pageDays));
};

const handleMoreTimeSlots = async (from, patient, offset) => {
  const session = getBookingSession(from);
  if (!session || !session.serviceId || !Array.isArray(session.availableSlots)) {
    clearBookingSession(from);
    return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
  }

  const minLeadMinutes = Number(process.env.MIN_BOOKING_LEAD_MINUTES || 10);
  const earliestBookableTime = new Date(Date.now() + minLeadMinutes * 60 * 1000);
  const futureSlots = session.availableSlots.filter((slot) => new Date(slot.time) >= earliestBookableTime);
  const pageSlots = buildTimeSlotPage(futureSlots, offset);

  if (pageSlots.length === 0) {
    return await whatsappService.sendTextMessage(from, 'لا توجد مواعيد إضافية متاحة حالياً. يرجى اختيار فترة أخرى.');
  }

  session.availableSlots = futureSlots;
  session.slotOffset = offset;
  setBookingSession(from, session);

  const dateLabel = session.selectedDate ? formatDateAr(new Date(session.selectedDate)) : '';
  return await whatsappService.sendInteractiveMessage(buildTimeSlotSelection(from, pageSlots, dateLabel));
};

const handleTimeSlotSelection = async (from, patient, timeISO) => {
  const session = getBookingSession(from);
  if (!session || !session.serviceId) {
    clearBookingSession(from);
    return await whatsappService.sendInteractiveMessage(buildWelcomeMessage(from));
  }

  try {
    const minLeadMinutes = Number(process.env.MIN_BOOKING_LEAD_MINUTES || 10);
    if (new Date(timeISO) < new Date(Date.now() + minLeadMinutes * 60 * 1000)) {
      await whatsappService.sendTextMessage(from, 'هذا الموعد مر بالفعل أو قريب جداً من الوقت الحالي. يرجى اختيار موعد لاحق.');
      return await handleServiceSelection(from, patient, session.serviceId);
    }

    if (!session.doctorId) {
      const availability = await appointmentService.getAvailableDoctorsAt({
        serviceId: session.serviceId,
        scheduledTime: timeISO,
      });

      if (availability.doctors.length === 0) {
        await whatsappService.sendTextMessage(from, 'عذراً، لا يوجد أطباء متاحون في هذا الوقت. يرجى اختيار وقت آخر.');
        return await handleServiceSelection(from, patient, session.serviceId);
      }

      session.selectedTime = timeISO;
      session.serviceDuration = availability.service.duration;
      session.step = 'select_doctor_after_time';
      setBookingSession(from, session);

      return await whatsappService.sendInteractiveMessage(
        buildDoctorSelection(
          from,
          availability.doctors.map((doctor) => ({
            ...doctor,
            description: doctor.specialization || 'طبيب متاح في هذا الوقت',
          })),
          availability.service.nameAr
        )
      );
    }

    const result = await appointmentService.createAppointment({
      patientId: session.patientId || patient.id,
      doctorId: session.doctorId,
      serviceId: session.serviceId,
      scheduledTime: timeISO,
      rescheduleAptId: session.rescheduleAptId,
    });

    clearBookingSession(from);

    if (result.conflict) {
      await whatsappService.sendTextMessage(from, 'عذراً، هذا الموعد لم يعد متاحاً. يرجى اختيار موعد آخر.');
      return await startBookingFlow(from, patient);
    }

    // Send pending message
    await whatsappService.sendInteractiveMessage(buildPendingMessage(from, result.appointment.bookingRef));

    // Trigger Dashboard Notification
    await prisma.adminNotification.create({
      data: {
        title: 'حجز موعد جديد',
        message: `المريض ${patient.name} قام بحجز موعد وينتظر التأكيد.`,
        type: 'NEW_APPOINTMENT',
        link: `/appointments?doctorId=${result.appointment.doctorId}&appointmentId=${result.appointment.id}`,
      }
    });

  } catch (error) {
    console.error('[Booking] Error:', error);
    await whatsappService.sendTextMessage(from, 'عذراً، حدث خطأ. يرجى المحاولة لاحقاً.');
    clearBookingSession(from);
  }
};

const handleInquiry = async (from, patient, content) => {
  try {
    // Get recent conversation history
    const recentMessages = await prisma.message.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const history = recentMessages.reverse();

    const aiResponse = await openaiService.getInquiryResponse(content, history, patient.id);

    if (ADDRESS_INTENT_PATTERN.test(String(content || ''))) {
      const settings = await prisma.clinicSettings.findFirst({
        select: { locationImageUrl: true },
      });

      if (settings?.locationImageUrl) {
        await whatsappService.sendImageMessage(from, settings.locationImageUrl, aiResponse);
        return;
      }
    }

    await whatsappService.sendTextMessage(from, aiResponse);
  } catch (error) {
    console.error('[WhatsApp] handleInquiry ERROR:', error.message);
    await whatsappService.sendTextMessage(from, 'عذراً، حدث خطأ تقني. يرجى المحاولة لاحقاً أو التواصل معنا مباشرة.');
  }
};

const handleTextBookingRequest = async (from, patient, content, session) => {
  const parsed = parseTextBookingRequest(content);
  if (!parsed) {
    return await whatsappService.sendTextMessage(from, 'لم أفهم الموعد. اكتب اليوم والساعة والتاريخ بهذا الشكل:\nالخميس 9 مساءً 28/6');
  }

  const minLeadMinutes = Number(process.env.MIN_BOOKING_LEAD_MINUTES || 10);
  if (parsed.scheduledTime < new Date(Date.now() + minLeadMinutes * 60 * 1000)) {
    return await whatsappService.sendTextMessage(from, 'هذا الموعد مر بالفعل أو قريب جداً من الوقت الحالي. اكتب موعداً لاحقاً.');
  }

  if (parsed.mentionedDay !== null && parsed.mentionedDay !== parsed.scheduledTime.getDay()) {
    return await whatsappService.sendTextMessage(from, 'اليوم المكتوب لا يطابق التاريخ. تأكد من اليوم والتاريخ واكتبهما مرة أخرى.');
  }

  const availability = await appointmentService.getAvailableDoctorsAt({
    serviceId: session.serviceId,
    scheduledTime: parsed.scheduledTime.toISOString(),
  });

  if (!availability.doctors.length) {
    return await whatsappService.sendTextMessage(from, 'لا يوجد طبيب متاح في هذا الموعد حسب جدول العيادة. اكتب موعداً آخر.');
  }

  session.selectedTime = parsed.scheduledTime.toISOString();
  session.serviceDuration = availability.service.duration;

  if (availability.doctors.length === 1) {
    return await sendTextBookingSummary(from, session, availability);
  }

  session.step = 'select_doctor_after_time';
  setBookingSession(from, session);

  return await whatsappService.sendInteractiveMessage(
    buildDoctorSelection(
      from,
      availability.doctors.map((doctor) => ({
        ...doctor,
        description: doctor.specialization || 'متاح في الموعد المطلوب',
      })),
      availability.service.nameAr || availability.service.name
    )
  );
};

const handleSessionInput = async (from, patient, content, session) => {
  if (session.step === 'whatsapp_inquiry') {
    if (content && WHATSAPP_BOOKING_TEXT_PATTERN.test(content)) {
      clearBookingSession(from);
      await createWhatsAppCallbackRequest(patient, content);
      return await whatsappService.sendTextMessage(from, WHATSAPP_BOOKING_REQUEST_REPLY);
    }
    return await handleInquiry(from, patient, content);
  }

  // Generic session handler for text input during booking
  if (session.step === 'select_service') {
    const services = await prisma.service.findMany({ where: { active: true } });
    const pricedServices = await attachServiceDiscounts(services, patient.id);
    const selectedNumber = Number.parseInt(normalizeDigits(content).trim(), 10);
    const matchedByNumber =
      Number.isInteger(selectedNumber) && selectedNumber > 0
        ? (() => {
            const selectedOption = (session.serviceOptions || []).find((option) => option.index === selectedNumber);
            if (!selectedOption) return null;
            return pricedServices.find((service) => service.id === selectedOption.id) || null;
          })()
        : null;
    const matchedService = matchedByNumber || findServiceByText(pricedServices, content);

    if (!matchedService) {
      await whatsappService.sendTextMessage(
        from,
        `لم أتعرف على الخدمة المطلوبة.\n\n${buildServicesPrompt(pricedServices)}`
      );
      return;
    }

    return await beginServiceDaySelection(from, patient, matchedService, {
      rescheduleAptId: session.rescheduleAptId,
    });
  }
  if (session.step === 'text_booking_request') {
    return await handleTextBookingRequest(from, patient, content, session);
  }
  if (session.step === 'ask_consultation') {
    clearBookingSession(from);
    await prisma.consultation.create({
      data: {
        patientId: patient.id,
        question: content || '[رسالة وسائط - تم الإرسال]',
      }
    });

    // Trigger Dashboard Notification
    await prisma.adminNotification.create({
      data: {
        title: 'استشارة أونلاين جديدة',
        message: `المريض ${patient.name} أرسل طلب استشارة طبية.`,
        type: 'CONSULTATION_REQUEST',
        link: `/consultations?patientId=${patient.id}`,
      }
    });

    return await whatsappService.sendTextMessage(from, 'تم استلام استشارتك بنجاح. سيقوم الطبيب بمراجعتها والرد عليك في أقرب وقت عبر الواتساب.');
  }

  if (session.step === 'check_appointment') {
    clearBookingSession(from);
    const ref = content.trim();
    const appointment = await prisma.appointment.findUnique({
      where: { bookingRef: ref },
      include: { doctor: true, service: true }
    });

    if (!appointment) {
      return await whatsappService.sendTextMessage(from, 'عذراً، لم نتمكن من العثور على حجز بهذا الرقم. يرجى التأكد من الرقم شاملاً BK-.');
    }

    const statusMap = {
      PENDING: 'قيد المراجعة',
      CONFIRMED: 'تم التأكيد',
      REJECTED: 'تم الرفض',
      COMPLETED: 'مكتمل',
      CANCELLED: 'ملغي',
      NO_SHOW: 'لم يحضر',
      BLOCKED: 'مغلق'
    };

    const statusName = statusMap[appointment.status] || appointment.status;
    const details = `تفاصيل الحجز رقم: *${appointment.bookingRef}*\n\nالخدمة: ${appointment.service?.nameAr}\nالطبيب: ${appointment.doctor?.name}\nالموعد: ${formatDateAr(appointment.scheduledTime)}\nالوقت: ${formatTimeAr(appointment.scheduledTime)}\n\nحالة الحجز: ${statusName}`;

    return await whatsappService.sendTextMessage(from, details);
  }

  if (session.step === 'select_day' || session.step === 'select_period' || session.step === 'select_time') {
    // User typed instead of selecting - treat as inquiry
    clearBookingSession(from);
    return await handleInquiry(from, patient, content);
  }
};

// ===================== FACEBOOK MESSENGER =====================

const messengerVerify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.facebook.verifyToken) {
    console.log('[Messenger] Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
};

const messengerWebhook = async (req, res) => {
  try {
    if (!verifyWebhookSignature(req, config.facebook.appSecret, 'Messenger')) {
      return res.sendStatus(403);
    }

    res.sendStatus(200);

    const body = req.body;
    if (body.object !== 'page') return;

    console.log(
      '[Messenger] Incoming webhook:',
      JSON.stringify({
        object: body.object,
        entryCount: Array.isArray(body.entry) ? body.entry.length : 0,
      })
    );
    writeWebhookDebugLog('messenger_webhook', {
      object: body.object,
      entryCount: Array.isArray(body.entry) ? body.entry.length : 0,
    });

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if ((event.message && !event.message.is_echo) || event.postback) {
          const payload = getMessengerEventPayload(event);
          console.log(
            '[Messenger] Incoming messenger event:',
            JSON.stringify({
              senderId: event.sender?.id,
              hasText: !!event.message?.text,
              hasPostback: !!event.postback,
              metadataType: payload.metadataType,
              mid: event.message?.mid,
            })
          );
          writeWebhookDebugLog('messenger_message', {
            senderId: event.sender?.id,
            hasText: !!event.message?.text,
            hasPostback: !!event.postback,
            metadataType: payload.metadataType,
            mid: event.message?.mid,
          });
          await handleMessengerInboundClean(event);
        }
      }

      // Handle Facebook Comments
      for (const change of entry.changes || []) {
        if (change.field === 'feed') {
          const value = change.value;
          console.log(
            '[Messenger] Incoming feed change:',
            JSON.stringify({
              field: change.field,
              item: value?.item,
              verb: value?.verb,
              commentId: value?.comment_id,
              postId: value?.post_id,
              fromId: value?.from?.id,
              hasMessage: !!value?.message,
            })
          );
          writeWebhookDebugLog('messenger_feed_change', {
            field: change.field,
            item: value?.item,
            verb: value?.verb,
            commentId: value?.comment_id,
            postId: value?.post_id,
            fromId: value?.from?.id,
            hasMessage: !!value?.message,
          });
          if (value.item === 'comment' && value.verb === 'add') {
            // Ignore our own comments (page replying to users)
            if (value.from && value.from.id !== entry.id) {
              await handleFacebookCommentThread(value);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Messenger] Webhook error:', error);
  }
};

const handleFacebookComment = async (value) => {
  try {
    const commentId = value.comment_id;
    const content = value.message;

    // Skip empty or purely tag comments
    if (!content || content.trim() === '') return;

    console.log(
      '[Facebook Comment] Processing comment:',
      JSON.stringify({
        commentId,
        fromId: value?.from?.id,
        postId: value?.post_id,
        content,
      })
    );
    writeWebhookDebugLog('facebook_comment_processing', {
      commentId,
      fromId: value?.from?.id,
      postId: value?.post_id,
      content,
    });

    // Generate AI response
    const aiResponse = await openaiService.getInquiryResponse(content, []);

    // 1. Reply publicly to the comment
    await messengerService.sendCommentReply(commentId, aiResponse);
    console.log('[Facebook Comment] Public reply sent:', commentId);
    writeWebhookDebugLog('facebook_comment_public_reply_sent', { commentId });

    await messengerService.sendPrivateReply(commentId, FACEBOOK_COMMENT_DM_FOLLOWUP);
    console.log('[Facebook Comment] Private reply sent:', commentId);
    writeWebhookDebugLog('facebook_comment_private_reply_sent', { commentId });
    return;

    // 2. Send a private message (DM) follow-up
    await messengerService.sendPrivateReply(commentId, FACEBOOK_COMMENT_DM_FOLLOWUP);
    console.log('[Facebook Comment] Private reply sent:', commentId);
    writeWebhookDebugLog('facebook_comment_private_reply_sent', { commentId });

  } catch (error) {
    console.error('[Facebook Comment] Error:', error.message);
    writeWebhookDebugLog('facebook_comment_error', { message: error.message });
  }
};

const handleFacebookCommentThread = async (value) => {
  try {
    const commentId = value.comment_id;
    const content = value.message;
    const senderId = value?.from?.id;
    const postId = value?.post_id;

    if (!content || content.trim() === '') {
      return;
    }

    console.log(
      '[Facebook Comment] Processing comment:',
      JSON.stringify({
        commentId,
        fromId: senderId,
        postId,
        content,
      })
    );
    writeWebhookDebugLog('facebook_comment_processing', {
      commentId,
      fromId: senderId,
      postId,
      content,
    });

    const patient = await findOrCreateSocialPatient({
      platform: 'FACEBOOK',
      senderId,
      fallbackName: MESSENGER_FALLBACK_NAME,
    });

    await persistSocialMessage({
      patientId: patient.id,
      platform: 'FACEBOOK',
      content,
      type: 'INBOUND',
      metadata: {
        source: 'COMMENT',
        commentId,
        postId,
        senderId,
        raw: value,
      },
    });

    const aiResponse = await openaiService.getInquiryResponse(content, []);

    await messengerService.sendCommentReply(commentId, aiResponse);
    console.log('[Facebook Comment] Public reply sent:', commentId);
    writeWebhookDebugLog('facebook_comment_public_reply_sent', { commentId });

    await persistSocialMessage({
      patientId: patient.id,
      platform: 'FACEBOOK',
      content: aiResponse,
      type: 'OUTBOUND',
      metadata: {
        source: 'COMMENT_REPLY',
        delivery: 'PUBLIC_COMMENT',
        commentId,
        postId,
        auto: true,
      },
    });

    try {
      await messengerService.sendPrivateReply(commentId, FACEBOOK_COMMENT_DM_FOLLOWUP);
      console.log('[Facebook Comment] Private reply sent:', commentId);
      writeWebhookDebugLog('facebook_comment_private_reply_sent', { commentId });

      await persistSocialMessage({
        patientId: patient.id,
        platform: 'FACEBOOK',
        content: FACEBOOK_COMMENT_DM_FOLLOWUP,
        type: 'OUTBOUND',
        metadata: {
          source: 'COMMENT_REPLY',
          delivery: 'PRIVATE_DM_FOLLOWUP',
          commentId,
          postId,
          auto: true,
        },
      });
    } catch (privateReplyError) {
      console.error('[Facebook Comment] Private reply error:', privateReplyError.message);
      writeWebhookDebugLog('facebook_comment_private_reply_error', {
        commentId,
        message: privateReplyError.message,
      });
    }
  } catch (error) {
    console.error('[Facebook Comment] Error:', error.message);
    writeWebhookDebugLog('facebook_comment_error', { message: error.message });
  }
};

const handleMessengerInbound = async (event) => {
  const senderId = event.sender.id;
  const { displayContent, routeContent, metadataType } = getMessengerEventPayload(event);
  const content = displayContent;
  const routingContent = routeContent || displayContent;

  try {
    const patient = await findOrCreateSocialPatient({
      platform: 'FACEBOOK',
      senderId,
      fallbackName: MESSENGER_FALLBACK_NAME,
    });

    await prisma.message.create({
      data: {
        patientId: patient.id,
        platform: 'FACEBOOK',
        content: content || `[${metadataType}]`,
        type: 'INBOUND',
        metadata: event,
      },
    });

    if (/حجز|موعد|احجز|book|appointment|BOOK_APPOINTMENT/i.test(routingContent)) {
      await messengerService.sendWhatsAppRedirect(senderId);
      return;
    }

    const settings = await prisma.clinicSettings.findFirst();
    if (settings?.aiEnabled) {
      const recentMessages = await prisma.message.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const aiResponse = await openaiService.getInquiryResponse(content || routingContent, recentMessages.reverse());
      await messengerService.sendTextMessage(senderId, aiResponse, SOCIAL_QUICK_REPLIES);

      await prisma.message.create({
        data: {
          patientId: patient.id,
          platform: 'FACEBOOK',
          content: aiResponse,
          type: 'OUTBOUND',
        },
      });

      return;
    }

    return await messengerService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);

    await messengerService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
  } catch (error) {
    console.error('[Messenger] handleMessengerInbound ERROR:', error.message);
  }
};

const handleMessengerMessage = async (event) => {
  const senderId = event.sender.id;
  const { displayContent, routeContent, metadataType } = getMessengerEventPayload(event);
  const content = displayContent;
  const routingContent = routeContent || displayContent;

  try {
    // Find or create patient
    let patient = await prisma.patient.findFirst({
      where: { OR: [{ whatsappId: senderId }, { phone: senderId }] },
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: MESSENGER_FALLBACK_NAME,
          phone: senderId,
          platform: 'FACEBOOK',
          whatsappId: senderId,
        },
      });
    }

    // Save inbound
    await prisma.message.create({
      data: {
        patientId: patient.id,
        platform: 'FACEBOOK',
        content,
        type: 'INBOUND',
      },
    });

    // Check if booking-related
    if (/حجز|موعد|احجز|book|appointment|BOOK_APPOINTMENT/i.test(content)) {
      await messengerService.sendWhatsAppRedirect(senderId);
      return;
    }

    // AI response for inquiries
    const settings = await prisma.clinicSettings.findFirst();
    if (settings?.aiEnabled) {
      const recentMessages = await prisma.message.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const aiResponse = await openaiService.getInquiryResponse(content, recentMessages.reverse());
      await messengerService.sendTextMessage(senderId, aiResponse, SOCIAL_QUICK_REPLIES);

      await prisma.message.create({
        data: {
          patientId: patient.id,
          platform: 'FACEBOOK',
          content: aiResponse,
          type: 'OUTBOUND',
        },
      });
    } else {
      await messengerService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
    }
  } catch (error) {
    console.error('[Messenger] handleMessengerMessage ERROR:', error.message);
  }
};

// ===================== INSTAGRAM =====================

const instagramVerify = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.instagram.verifyToken) {
    console.log('[Instagram] Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
};

const instagramWebhook = async (req, res) => {
  try {
    if (!verifyWebhookSignature(req, config.facebook.appSecret, 'Instagram')) {
      return res.sendStatus(403);
    }

    res.sendStatus(200);

    const body = req.body;
    if (body.object !== 'instagram') return;

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        if (event.message && !event.message.is_echo) {
          await handleInstagramInboundClean(event);
        }
      }

      // Handle Instagram Comments
      for (const change of entry.changes || []) {
        if (change.field === 'comments') {
          const value = change.value;
          // value is an Instagram comment object. Ensure it has text.
          if (value.id && value.text) {
            // Assume we want to reply to user comments
            if (value.from && value.from.id !== entry.id) {
              await handleInstagramCommentThread(value);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Instagram] Webhook error:', error);
  }
};

const handleInstagramComment = async (value) => {
  try {
    const commentId = value.id;
    const content = value.text;

    if (!content || content.trim() === '') return;

    // Generate AI response
    const aiResponse = await openaiService.getInquiryResponse(content, []);

    // Reply publicly to the comment
    await instagramService.sendCommentReply(commentId, aiResponse);
  } catch (error) {
    console.error('[Instagram Comment] Error:', error.message);
  }
};

const handleInstagramCommentThread = async (value) => {
  try {
    const commentId = value.id;
    const content = value.text;
    const senderId = value?.from?.id;
    const postId = value?.media?.id || value?.post_id || null;

    if (!content || content.trim() === '') {
      return;
    }

    const patient = await findOrCreateSocialPatient({
      platform: 'INSTAGRAM',
      senderId,
      fallbackName: INSTAGRAM_FALLBACK_NAME,
    });

    await persistSocialMessage({
      patientId: patient.id,
      platform: 'INSTAGRAM',
      content,
      type: 'INBOUND',
      metadata: {
        source: 'COMMENT',
        commentId,
        postId,
        senderId,
        raw: value,
      },
    });

    const aiResponse = await openaiService.getInquiryResponse(content, []);
    await instagramService.sendCommentReply(commentId, aiResponse);

    await persistSocialMessage({
      patientId: patient.id,
      platform: 'INSTAGRAM',
      content: aiResponse,
      type: 'OUTBOUND',
      metadata: {
        source: 'COMMENT_REPLY',
        delivery: 'PUBLIC_COMMENT',
        commentId,
        postId,
        auto: true,
      },
    });
  } catch (error) {
    console.error('[Instagram Comment] Error:', error.message);
  }
};

const handleInstagramInbound = async (event) => {
  const senderId = event.sender.id;
  const { displayContent, routeContent, metadataType } = getInstagramEventPayload(event);
  const content = displayContent;
  const routingContent = routeContent || displayContent;

  try {
    const patient = await findOrCreateSocialPatient({
      platform: 'INSTAGRAM',
      senderId,
      fallbackName: INSTAGRAM_FALLBACK_NAME,
    });

    await prisma.message.create({
      data: {
        patientId: patient.id,
        platform: 'INSTAGRAM',
        content: content || `[${metadataType}]`,
        type: 'INBOUND',
        metadata: event,
      },
    });

    if (/حجز|موعد|احجز|book|appointment|BOOK_APPOINTMENT/i.test(routingContent)) {
      await instagramService.sendWhatsAppRedirect(senderId);
      return;
    }

    const settings = await prisma.clinicSettings.findFirst();
    if (settings?.aiEnabled) {
      const recentMessages = await prisma.message.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const aiResponse = await openaiService.getInquiryResponse(content || routingContent, recentMessages.reverse());
      await instagramService.sendTextMessage(senderId, aiResponse, SOCIAL_QUICK_REPLIES);

      await prisma.message.create({
        data: {
          patientId: patient.id,
          platform: 'INSTAGRAM',
          content: aiResponse,
          type: 'OUTBOUND',
        },
      });

      return;
    }

    await instagramService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
  } catch (error) {
    console.error('[Instagram] handleInstagramInbound ERROR:', error.message);
  }
};

const handleInstagramMessage = async (event) => {
  const senderId = event.sender.id;
  const content = event.message.text || '';

  try {
    // Find or create patient
    let patient = await prisma.patient.findFirst({
      where: { OR: [{ whatsappId: senderId }, { phone: senderId }] },
    });

    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          name: INSTAGRAM_FALLBACK_NAME,
          phone: senderId,
          platform: 'INSTAGRAM',
          whatsappId: senderId,
        },
      });
    }

    // Save inbound
    await prisma.message.create({
      data: {
        patientId: patient.id,
        platform: 'INSTAGRAM',
        content,
        type: 'INBOUND',
      },
    });

    // Check if booking-related
    if (/حجز|موعد|احجز|book|appointment|BOOK_APPOINTMENT/i.test(content)) {
      await instagramService.sendWhatsAppRedirect(senderId);
      return;
    }

    // AI response
    const settings = await prisma.clinicSettings.findFirst();
    if (settings?.aiEnabled) {
      const recentMessages = await prisma.message.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const aiResponse = await openaiService.getInquiryResponse(content, recentMessages.reverse());
      await instagramService.sendTextMessage(senderId, aiResponse, SOCIAL_QUICK_REPLIES);

      await prisma.message.create({
        data: {
          patientId: patient.id,
          platform: 'INSTAGRAM',
          content: aiResponse,
          type: 'OUTBOUND',
        },
      });
    } else {
      await instagramService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
    }
  } catch (error) {
    console.error('[Instagram] handleInstagramMessage ERROR:', error.message);
  }
};

const handleMessengerInboundClean = async (event) => {
  const senderId = event.sender.id;
  const { displayContent, routeContent, metadataType } = getMessengerEventPayload(event);
  const content = displayContent;
  const routingContent = routeContent || displayContent;

  try {
    const patient = await findOrCreateSocialPatient({
      platform: 'FACEBOOK',
      senderId,
      fallbackName: MESSENGER_FALLBACK_NAME,
    });

    await prisma.message.create({
      data: {
        patientId: patient.id,
        platform: 'FACEBOOK',
        content: content || `[${metadataType}]`,
        type: 'INBOUND',
        metadata: event,
      },
    });

    if (patient.chatState === 'HUMAN') {
      return;
    }

    if (SOCIAL_BOOKING_PATTERN.test(routingContent)) {
      await messengerService.sendWhatsAppRedirect(senderId);
      return;
    }

    const settings = await prisma.clinicSettings.findFirst();
    if (settings?.aiEnabled) {
      const recentMessages = await prisma.message.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const aiResponse = await openaiService.getInquiryResponse(
        content || routingContent,
        recentMessages.reverse()
      );

      await messengerService.sendTextMessage(senderId, aiResponse, SOCIAL_QUICK_REPLIES);

      await prisma.message.create({
        data: {
          patientId: patient.id,
          platform: 'FACEBOOK',
          content: aiResponse,
          type: 'OUTBOUND',
        },
      });

      return;
    }

    await messengerService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
  } catch (error) {
    console.error('[Messenger] handleMessengerInboundClean ERROR:', error.message);
    try {
      await messengerService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
    } catch (sendError) {
      console.error('[Messenger] fallback send ERROR:', sendError.message);
    }
  }
};

const handleInstagramInboundClean = async (event) => {
  const senderId = event.sender.id;
  const { displayContent, routeContent, metadataType } = getInstagramEventPayload(event);
  const content = displayContent;
  const routingContent = routeContent || displayContent;

  try {
    const patient = await findOrCreateSocialPatient({
      platform: 'INSTAGRAM',
      senderId,
      fallbackName: INSTAGRAM_FALLBACK_NAME,
    });

    await prisma.message.create({
      data: {
        patientId: patient.id,
        platform: 'INSTAGRAM',
        content: content || `[${metadataType}]`,
        type: 'INBOUND',
        metadata: event,
      },
    });

    if (patient.chatState === 'HUMAN') {
      return;
    }

    if (SOCIAL_BOOKING_PATTERN.test(routingContent)) {
      await instagramService.sendWhatsAppRedirect(senderId);
      return;
    }

    const settings = await prisma.clinicSettings.findFirst();
    if (settings?.aiEnabled) {
      const recentMessages = await prisma.message.findMany({
        where: { patientId: patient.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const aiResponse = await openaiService.getInquiryResponse(
        content || routingContent,
        recentMessages.reverse()
      );

      await instagramService.sendTextMessage(senderId, aiResponse, SOCIAL_QUICK_REPLIES);

      await prisma.message.create({
        data: {
          patientId: patient.id,
          platform: 'INSTAGRAM',
          content: aiResponse,
          type: 'OUTBOUND',
        },
      });

      return;
    }

    await instagramService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
  } catch (error) {
    console.error('[Instagram] handleInstagramInboundClean ERROR:', error.message);
    try {
      await instagramService.sendTextMessage(senderId, SOCIAL_FALLBACK_REPLY, [SOCIAL_QUICK_REPLIES[0]]);
    } catch (sendError) {
      console.error('[Instagram] fallback send ERROR:', sendError.message);
    }
  }
};

module.exports = {
  whatsappVerify: whatsappVerifyHandler,
  whatsappWebhook,
  messengerVerify,
  messengerWebhook,
  instagramVerify,
  instagramWebhook,
};
