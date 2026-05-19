const { OpenAI } = require('openai');
const config = require('../config/env');
const prisma = require('../lib/prisma');
const { resolveWhatsAppChatLink } = require('../utils/clinicLinks');
const { formatCurrency, formatDateAr, formatDayNameAr, formatTimeAr, normalizeWorkingPeriods } = require('../utils/helpers');
const { getDiscountForService } = require('./discountService');
const {
  formatFaqsForPrompt,
  formatKnowledgeForPrompt,
  getAiConfigFromSettings,
  matchKnowledgeCases,
  buildAiConfig,
} = require('../utils/aiKnowledge');

let openaiClient = null;

const PRICE_INTENT_PATTERN = /(?:سعر|أسعار|تكلفة|رسوم|الكشف|الخدمات|service\s*price|price\s*list)/i;
const SERVICES_INTENT_PATTERN = /(?:الخدمات|الخدمات\s*المتاحة|services?)/i;
const DOCTOR_SCHEDULE_INTENT_PATTERN =
  /(?:مواعيد\s*الدكاتره|مواعيد\s*الدكاترة|مواعيد\s*الأطباء|دوام\s*الدكاتره|دوام\s*الدكاترة|doctor\s*schedules?)/i;
const APPOINTMENT_INFO_PATTERN =
  /(?:متى\s*(?:موعدي|حجزي|الحجز)|شنو\s*موعدي|ما\s*هو\s*موعدي|معادي|ميعادي|حاجز(?:\s*اليوم)?|موعدي\s*امتى|اروح\s*(?:امتى|متى)|أجي\s*(?:امتى|متى)|تذكير\s*بالحجز|موعد\s*الحجز|reservation\s*date|when\s+is\s+my\s+appointment|what\s+time\s+should\s+i\s+come|am\s+i\s+booked\s+today|remind\s+me\s+of\s+my\s+booking)/i;

const dayLabelsAr = {
  sunday: 'الأحد',
  monday: 'الاثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const getClient = () => {
  if (!openaiClient && config.openai.apiKey) {
    openaiClient = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
};

const formatWorkingHours = (workingHours = {}) =>
  Object.entries(dayLabelsAr)
    .map(([dayKey, label]) => {
      const hours = workingHours?.[dayKey];
      if (!hours?.start || !hours?.end) {
        return `- ${label}: مغلق`;
      }

      return `- ${label}: ${hours.start} إلى ${hours.end}`;
    })
    .join('\n');

const getOpeningTimeForDate = (date, workingHours = {}) => {
  const target = new Date(date);
  const dayKey = dayNames[target.getDay()];
  const periods = normalizeWorkingPeriods(workingHours?.[dayKey]);
  if (!periods.length) return null;
  const firstPeriod = periods
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))[0];
  const [hour, minute] = String(firstPeriod.start).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const opening = new Date(target);
  opening.setHours(hour, minute, 0, 0);
  return opening;
};

const buildAppointmentInfoReply = async (patientId) => {
  if (!patientId) {
    return 'لا يوجد لديك حجز قادم حالياً. تواصل معنا للحجز.';
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      displayName: true,
      appointments: {
        where: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_ROOM'] },
          scheduledTime: { gte: new Date() },
        },
        orderBy: { scheduledTime: 'asc' },
        take: 2,
        include: {
          doctor: { select: { workingHours: true } },
        },
      },
    },
  });

  const nextAppointment = patient?.appointments?.[0];
  if (!nextAppointment) {
    return 'لا يوجد لديك حجز قادم حالياً. تواصل معنا للحجز.';
  }

  const settings = await prisma.clinicSettings.findFirst({
    select: { workingHours: true },
  });
  const openingTime =
    getOpeningTimeForDate(nextAppointment.scheduledTime, nextAppointment.doctor?.workingHours || {}) ||
    getOpeningTimeForDate(nextAppointment.scheduledTime, settings?.workingHours || {}) ||
    (process.env.DEFAULT_REMINDER_OPENING_TIME || '3:00 PM');
  const openingLabel = typeof openingTime === 'string' ? openingTime : formatTimeAr(openingTime);

  const lines = [
    `لديك موعد قادم يوم ${formatDayNameAr(nextAppointment.scheduledTime)} الموافق ${formatDateAr(
      nextAppointment.scheduledTime
    )}.`,
    `تفتح العيادة الساعة ${openingLabel}، والاستقبال بالترتيب حسب الحضور.`,
    'يرجى العلم أن هذا وقت فتح العيادة وليس وقتًا محددًا خاصًا بك.',
  ];

  if ((patient.appointments || []).length > 1) {
    lines.push('ولديك مواعيد أخرى قادمة، تواصل معنا للتفاصيل.');
  }

  return lines.join('\n');
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
  if (!patientId) return formatCurrency(service.price);

  const discount = await getDiscountForService({ patientId, service });
  if (!discount.discountAmount) return formatCurrency(discount.amount);

  const discountLabel = discount.rule?.name ? `عرض ${discount.rule.name}` : 'عرض خاص';
  const valueLabel = discount.rule?.type === 'PERCENT'
    ? `خصم ${Number(discount.rule.value).toLocaleString('ar-EG')}%`
    : `خصم ${formatCurrency(discount.discountAmount)}`;

  return `السعر بعد الخصم ${formatCurrency(discount.finalAmount)} بدلاً من ${formatCurrency(discount.amount)} (${discountLabel} - ${valueLabel})`;
};

const buildServicesInfo = async (patientId = null) => {
  try {
    const services = await prisma.service.findMany({ where: { active: true } });
    if (!services.length) return '';

    const lines = [];
    for (const service of services) {
      const price = await formatServicePriceForPatient(service, patientId);
      lines.push(`- ${service.nameAr || service.name}: ${service.description || ''}${price ? ` (${price})` : ''}`);
    }

    return [
      'الخدمات المتاحة:',
      ...lines,
    ].join('\n');
  } catch (error) {
    return '';
  }
};

const buildServicePricesReplySuffix = async (patientId = null) => {
  try {
    const services = await prisma.service.findMany({
      where: {
        active: true,
        OR: [
          { price: { not: null } },
          { priceFrom: { not: null } },
          { priceTo: { not: null } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nameAr: true,
        name: true,
        price: true,
        priceFrom: true,
        priceTo: true,
      },
    });

    if (!services.length) return '';

    const lines = [];
    for (const service of services) {
      const price = await formatServicePriceForPatient(service, patientId);
      lines.push(`- ${service.nameAr || service.name || 'خدمة'}: ${price}`);
    }

    return ['أسعار الخدمات المتاحة:', ...lines].join('\n');
  } catch (error) {
    return '';
  }
};

const buildServicesDirectReply = async (patientId = null) => {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nameAr: true,
        name: true,
        description: true,
        price: true,
        priceFrom: true,
        priceTo: true,
      },
    });

    if (!services.length) {
      return 'لا توجد خدمات مضافة حالياً.';
    }

    const lines = [];
    for (const service of services) {
      const serviceName = service.nameAr || service.name || 'خدمة';
      const price = await formatServicePriceForPatient(service, patientId);
      const pricePart = price ? ` - ${price}` : '';
      const descriptionPart = service.description ? `\n${service.description}` : '';
      lines.push(`- ${serviceName}${pricePart}${descriptionPart}`);
    }

    return ['الخدمات المتاحة في العيادة:', ...lines].join('\n');
  } catch (error) {
    return '';
  }
};

const buildDoctorsSchedulesReply = async () => {
  try {
    const doctors = await prisma.doctor.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        specialization: true,
        workingHours: true,
      },
    });

    if (!doctors.length) {
      return 'لا يوجد دكاترة مضافون حالياً.';
    }

    return [
      'مواعيد الدكاتره:',
      ...doctors.map((doctor) => {
        const specialization = doctor.specialization ? ` - ${doctor.specialization}` : '';
        return `- ${doctor.name}${specialization}\n${formatWorkingHours(doctor.workingHours || {})}`;
      }),
    ].join('\n\n');
  } catch (error) {
    return '';
  }
};

const buildClinicInfoContext = (settingsSource = {}) => {
  const whatsappChatLink = resolveWhatsAppChatLink({
    whatsappChatLink: settingsSource?.whatsappChatLink,
    phone: settingsSource?.phone,
  });

  return [
    'معلومات العيادة الحالية:',
    `- اسم العيادة: ${settingsSource?.clinicNameAr || settingsSource?.clinicName || 'غير محدد'}`,
    `- رقم التواصل: ${settingsSource?.phone || 'غير متوفر'}`,
    `- العنوان: ${settingsSource?.address || 'غير متوفر'}`,
    `- رابط واتساب المباشر: ${whatsappChatLink || 'غير متوفر'}`,
    `- رابط Google Maps: ${settingsSource?.googleMapsLink || 'غير متوفر'}`,
    '- مواعيد العمل:',
    formatWorkingHours(settingsSource?.workingHours || {}),
  ].join('\n');
};

const buildDirectClinicReply = (userMessage, settingsSource = {}) => {
  const message = String(userMessage || '');
  const wantsAddress =
    /(عنوان|العنوان|الموقع|لوكيشن|location|map|maps|خرائط|جوجل\s*ماب|google\s*maps)/i.test(message);
  const wantsHours =
    /(مواعيد\s*العمل|ساعات\s*العمل|الدوام|مواعيدكم|متى\s*تفتحون|متى\s*تفتحوا|فاتحين|open|working hours)/i.test(
      message
    );
  const wantsPhone =
    /(رقم\s*التواصل|رقم\s*العيادة|رقمكم|رقم\s*الهاتف|رقم\s*الجوال|التواصل\s*معكم|الهاتف|اتصال)/i.test(
      message
    );
  const wantsWhatsapp = /(واتساب|واتس|whatsapp|رابط\s*الواتس|لينك\s*الواتس|chat link)/i.test(message);

  if (!wantsAddress && !wantsHours && !wantsPhone && !wantsWhatsapp) {
    return null;
  }

  const sections = [];
  const whatsappChatLink = resolveWhatsAppChatLink({
    whatsappChatLink: settingsSource?.whatsappChatLink,
    phone: settingsSource?.phone,
  });

  if (wantsAddress && (settingsSource?.address || settingsSource?.googleMapsLink)) {
    const addressLines = [];
    if (settingsSource?.address) {
      addressLines.push(`عنوان العيادة: ${settingsSource.address}`);
    }
    if (settingsSource?.googleMapsLink) {
      addressLines.push(`رابط الموقع على Google Maps:\n${settingsSource.googleMapsLink}`);
    }
    sections.push(addressLines.join('\n'));
  }

  if (wantsHours && settingsSource?.workingHours) {
    sections.push(`مواعيد العمل:\n${formatWorkingHours(settingsSource.workingHours)}`);
  }

  if (wantsPhone && settingsSource?.phone) {
    sections.push(`رقم التواصل: ${settingsSource.phone}`);
  }

  if (wantsWhatsapp && whatsappChatLink) {
    sections.push(`رابط واتساب المباشر:\n${whatsappChatLink}`);
  }

  return sections.length ? sections.join('\n\n') : null;
};

const buildRuntimeContext = (settingsSource, userMessage) => {
  const systemPrompt =
    settingsSource?.systemPrompt ||
    `أنت مساعد ذكي لعيادة أسنان.
أجب على استفسارات المرضى بأسلوب مهني وواضح ومطمئن.
لا تقدم تشخيصاً نهائياً، ووجّه المريض إلى الفحص عند الحاجة.
إذا كان المريض يريد الحجز، ساعده للوصول إلى خطوة الحجز المناسبة.`;

  const aiConfig = getAiConfigFromSettings(settingsSource);
  const matchedKnowledge = matchKnowledgeCases(userMessage, aiConfig.knowledgeCases);
  const selectedKnowledge = matchedKnowledge.length ? matchedKnowledge : aiConfig.knowledgeCases.slice(0, 4);

  return {
    systemPrompt,
    aiConfig,
    matchedKnowledge,
    selectedKnowledge,
  };
};

const generateInquiryResponse = async ({
  userMessage,
  conversationHistory = [],
  settingsOverride = null,
  includeDebug = false,
  patientId = null,
}) => {
  let settingsSource = settingsOverride;
  if (!settingsSource) {
    try {
      settingsSource = await prisma.clinicSettings.findFirst();
    } catch (error) {
      settingsSource = null;
    }
  }

  const directClinicReply = buildDirectClinicReply(userMessage, settingsSource);
  const wantsServicePrices = PRICE_INTENT_PATTERN.test(String(userMessage || ''));
  const wantsServices = SERVICES_INTENT_PATTERN.test(String(userMessage || ''));
  const wantsDoctorSchedules = DOCTOR_SCHEDULE_INTENT_PATTERN.test(String(userMessage || ''));
  const wantsAppointmentInfo = APPOINTMENT_INFO_PATTERN.test(String(userMessage || ''));

  if (wantsAppointmentInfo) {
    const appointmentReply = await buildAppointmentInfoReply(patientId);
    return includeDebug
      ? { reply: appointmentReply, matchedKnowledgeCases: [], usedFaqCount: 0 }
      : appointmentReply;
  }

  const servicePricesSuffix = wantsServicePrices ? await buildServicePricesReplySuffix(patientId) : '';
  const servicesDirectReply = wantsServices ? await buildServicesDirectReply(patientId) : '';
  const doctorSchedulesReply = wantsDoctorSchedules ? await buildDoctorsSchedulesReply() : '';

  const directSections = [directClinicReply, servicesDirectReply, doctorSchedulesReply].filter(Boolean);
  if (directSections.length > 0) {
    const directReply =
      servicePricesSuffix && !servicesDirectReply
        ? [...directSections, servicePricesSuffix].join('\n\n')
        : directSections.join('\n\n');

    return includeDebug
      ? { reply: directReply, matchedKnowledgeCases: [], usedFaqCount: 0 }
      : directReply;
  }

  const client = getClient();
  if (!client) {
    console.log('[OpenAI] API key not configured. Returning default response.');
    const fallback =
      'شكراً لتواصلك معنا. تم استلام رسالتك، ويمكنك المتابعة معنا للحجز أو للفحص إذا كانت الحالة مستمرة أو مزعجة.';
    const fallbackReply =
      fallback && servicePricesSuffix ? [fallback, servicePricesSuffix].join('\n\n') : fallback;
    return includeDebug ? { reply: fallbackReply, matchedKnowledgeCases: [] } : fallbackReply;
  }

  const { systemPrompt, matchedKnowledge, selectedKnowledge, aiConfig } = buildRuntimeContext(
    settingsSource,
    userMessage
  );
  const clinicInfo = buildClinicInfoContext(settingsSource);
  const servicesInfo = await buildServicesInfo(patientId);
  const faqInfo = formatFaqsForPrompt(aiConfig.faqs);
  const knowledgeInfo = formatKnowledgeForPrompt(selectedKnowledge);

  const assistantRules = `تعليمات الرد:
- استخدم المعلومات التالية كمرجع مساعد، وليس كتشخيص نهائي.
- عند السؤال عن عنوان العيادة أو مواعيد العمل أو رقم التواصل أو رابط واتساب أو رابط Google Maps، استخدم بيانات العيادة المتوفرة حرفياً وقدّمها مباشرة.
- عند السؤال عن موعد الحجز أو متى يأتي المريض أو متى موعده، لا تخترع وقتاً شخصياً. استخدم فقط بيانات الحجز الحقيقية إن كانت متوفرة، واذكر أن الوصول يكون حسب الحضور وأن الوقت المذكور هو وقت فتح العيادة إن لزم.
- عند السؤال عن الخدمات، اعرض الخدمات الموجودة فقط.
- عند السؤال عن مواعيد الدكاتره، اعرض أسماء الدكاتره ومواعيدهم من البيانات.
- إذا كانت صياغة المريض عراقية، فاجعل الرد باللهجة العراقية البسيطة قدر الإمكان.
- عند وجود حالة مطابقة، حاول أن يتضمن الرد: تفسير مبسط، هل يمكن التأجيل أم لا، نصيحة منزلية مختصرة، وتوجيه واضح للفحص أو الحجز.
- إذا ظهرت علامات مثل تورم واضح أو نزيف مستمر أو ألم شديد يمنع النوم أو صعوبة فتح الفم أو الأكل، شدد على سرعة المراجعة.
- لا تختلق أسعاراً أو خدمات غير موجودة في البيانات.
- اجعل الرد مختصراً وواضحاً ومطمئناً من غير مبالغة طبية.`;

  const messages = [
    {
      role: 'system',
      content: [systemPrompt, assistantRules, clinicInfo, servicesInfo, faqInfo, knowledgeInfo]
        .filter(Boolean)
        .join('\n\n'),
    },
    ...conversationHistory.map((message) => ({
      role: message.type === 'INBOUND' ? 'user' : 'assistant',
      content: message.content,
    })),
    {
      role: 'user',
      content: userMessage,
    },
  ];

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;
    const finalReply =
      servicePricesSuffix && reply && !reply.includes('أسعار الخدمات')
        ? [reply, servicePricesSuffix].join('\n\n')
        : reply;

    if (includeDebug) {
      return {
        reply: finalReply,
        matchedKnowledgeCases: matchedKnowledge.map((entry) => ({
          title: entry.title,
          symptom: entry.symptom,
          specialty: entry.specialty,
          urgency: entry.urgency,
        })),
        usedFaqCount: aiConfig.faqs.length,
      };
    }

    return finalReply;
  } catch (error) {
    console.error('[OpenAI] Error:', error.message);
    const fallback = 'عذراً، حدث خطأ تقني. يمكنك إعادة المحاولة أو التواصل معنا مباشرة إذا كانت الحالة عاجلة.';
    const fallbackReply =
      fallback && servicePricesSuffix ? [fallback, servicePricesSuffix].join('\n\n') : fallback;
    return includeDebug ? { reply: fallbackReply, matchedKnowledgeCases: [] } : fallbackReply;
  }
};

const getInquiryResponse = async (userMessage, conversationHistory = [], patientId = null) =>
  generateInquiryResponse({ userMessage, conversationHistory, patientId });

const previewInquiryResponse = async ({
  userMessage,
  conversationHistory = [],
  systemPrompt,
  faqs,
  knowledgeCases,
  clinicName,
  clinicNameAr,
  phone,
  address,
  workingHours,
  whatsappChatLink,
  googleMapsLink,
}) => {
  const settingsOverride = {
    systemPrompt,
    clinicName,
    clinicNameAr,
    phone,
    address,
    workingHours,
    whatsappChatLink,
    googleMapsLink,
    faqData: buildAiConfig({ faqs, knowledgeCases }),
  };

  return generateInquiryResponse({
    userMessage,
    conversationHistory,
    settingsOverride,
    includeDebug: true,
  });
};

module.exports = {
  getInquiryResponse,
  previewInquiryResponse,
};
