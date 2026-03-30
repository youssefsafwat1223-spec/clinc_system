const prisma = require('../lib/prisma');
const openaiService = require('../services/openaiService');
const { buildWhatsAppChatLink } = require('../utils/clinicLinks');
const {
  DEFAULT_FAQS,
  DEFAULT_KNOWLEDGE_CASES,
  buildAiConfig,
  dedupeKnowledgeCases,
  getAiConfigFromSettings,
  normalizeAiConfig,
  parseKnowledgeCasesFromText,
} = require('../utils/aiKnowledge');

const createDefaultSettings = () => ({
  clinicName: 'My Clinic',
  phone: '+966501234567',
  address: 'الرياض، المملكة العربية السعودية',
  whatsappChatLink: buildWhatsAppChatLink('+966501234567'),
  googleMapsLink: 'https://maps.google.com/?q=%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D8%8C%20%D8%A7%D9%84%D9%85%D9%85%D9%84%D9%83%D8%A9%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9',
  clinicNameAr: 'عيادتي',
  systemPrompt: `أنت مساعد ذكي لعيادة أسنان.
أجب على أسئلة المرضى بأسلوب مهني وواضح ومطمئن.
لا تقدم تشخيصا نهائيا ولا وعودا طبية مبالغا فيها.
اشرح الحالة بشكل مبسط، واذكر متى يفضل عدم التأجيل، ثم وجه المريض إلى الفحص أو الحجز عند الحاجة.
إذا كانت صياغة المريض باللهجة العراقية فحافظ على لهجة بسيطة ومفهومة.`,
  workingHours: {
    sunday: { start: '09:00', end: '17:00' },
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '14:00' },
    friday: null,
    saturday: null,
  },
  faqData: buildAiConfig({
    faqs: DEFAULT_FAQS,
    knowledgeCases: DEFAULT_KNOWLEDGE_CASES,
  }),
});

const buildKnowledgeImportPreview = ({ currentAiConfig, importData, mode }) => {
  const existingCasesCount = currentAiConfig.knowledgeCases.length;
  const mergedKnowledgeCases =
    mode === 'replace'
      ? importData.cases
      : dedupeKnowledgeCases([...currentAiConfig.knowledgeCases, ...importData.cases]);

  const duplicatesAgainstExisting =
    mode === 'append'
      ? existingCasesCount + importData.cases.length - mergedKnowledgeCases.length
      : 0;

  return {
    mode,
    existingCases: existingCasesCount,
    finalCases: mergedKnowledgeCases.length,
    addedCases:
      mode === 'replace' ? mergedKnowledgeCases.length : mergedKnowledgeCases.length - existingCasesCount,
    duplicatesAgainstExisting,
    stats: importData.stats,
    previewCases: importData.cases.slice(0, 8),
  };
};

const getOrCreateSettings = async () => {
  let settings = await prisma.clinicSettings.findFirst();

  if (!settings) {
    settings = await prisma.clinicSettings.create({
      data: createDefaultSettings(),
    });
  }

  return settings;
};

const get = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();

    const aiConfig = getAiConfigFromSettings(settings);

    res.json({
      settings: {
        ...settings,
        faqs: aiConfig.faqs,
        knowledgeCases: aiConfig.knowledgeCases,
      },
    });
  } catch (error) {
    next(error);
  }
};

const importKnowledgeCases = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const { rawText, mode = 'append' } = req.body;

    if (!String(rawText || '').trim()) {
      return res.status(400).json({ error: 'النص الخام مطلوب للاستيراد' });
    }

    if (!['append', 'replace'].includes(mode)) {
      return res.status(400).json({ error: 'وضع الاستيراد غير صالح' });
    }

    const currentAiConfig = getAiConfigFromSettings(settings);
    const importData = parseKnowledgeCasesFromText(rawText);

    if (!importData.cases.length) {
      return res.status(400).json({ error: 'لم يتم استخراج أي حالات صالحة من النص المستورد' });
    }

    const importResult = buildKnowledgeImportPreview({
      currentAiConfig,
      importData,
      mode,
    });

    const updatedSettings = await prisma.clinicSettings.update({
      where: { id: settings.id },
      data: {
        faqData: buildAiConfig({
          faqs: currentAiConfig.faqs,
          knowledgeCases:
            mode === 'replace'
              ? importData.cases
              : dedupeKnowledgeCases([...currentAiConfig.knowledgeCases, ...importData.cases]),
        }),
      },
    });

    const aiConfig = getAiConfigFromSettings(updatedSettings);

    res.json({
      settings: {
        ...updatedSettings,
        faqs: aiConfig.faqs,
        knowledgeCases: aiConfig.knowledgeCases,
      },
      importResult: {
        ...importResult,
        finalCases: aiConfig.knowledgeCases.length,
        addedCases: mode === 'replace' ? aiConfig.knowledgeCases.length : aiConfig.knowledgeCases.length - importResult.existingCases,
      },
    });
  } catch (error) {
    next(error);
  }
};

const previewKnowledgeImport = async (req, res, next) => {
  try {
    const settings = await getOrCreateSettings();
    const { rawText, mode = 'append' } = req.body;

    if (!String(rawText || '').trim()) {
      return res.status(400).json({ error: 'النص الخام مطلوب للمعاينة' });
    }

    if (!['append', 'replace'].includes(mode)) {
      return res.status(400).json({ error: 'وضع المعاينة غير صالح' });
    }

    const currentAiConfig = getAiConfigFromSettings(settings);
    const importData = parseKnowledgeCasesFromText(rawText);

    if (!importData.cases.length) {
      return res.status(400).json({ error: 'لم يتم استخراج أي حالات صالحة من النص' });
    }

    res.json({
      importResult: buildKnowledgeImportPreview({
        currentAiConfig,
        importData,
        mode,
      }),
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const existing = await prisma.clinicSettings.findFirst();
    if (!existing) {
      return res.status(404).json({ error: 'لم يتم العثور على الإعدادات' });
    }

    const {
      clinicName,
      clinicNameAr,
      phone,
      address,
      whatsappChatLink,
      googleMapsLink,
      workingHours,
      systemPrompt,
      faqs,
      knowledgeCases,
      faqData,
      aiEnabled,
    } = req.body;

    const currentAiConfig = getAiConfigFromSettings(existing);
    const incomingAiConfig = faqData !== undefined ? normalizeAiConfig(faqData) : null;

    const nextFaqs =
      faqs !== undefined
        ? faqs
        : incomingAiConfig
          ? incomingAiConfig.faqs
          : currentAiConfig.faqs;

    const nextKnowledgeCases =
      knowledgeCases !== undefined
        ? knowledgeCases
        : incomingAiConfig
          ? incomingAiConfig.knowledgeCases
          : currentAiConfig.knowledgeCases;

    const settings = await prisma.clinicSettings.update({
      where: { id: existing.id },
      data: {
        ...(clinicName !== undefined && { clinicName }),
        ...(clinicNameAr !== undefined && { clinicNameAr }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(whatsappChatLink !== undefined && { whatsappChatLink }),
        ...(googleMapsLink !== undefined && { googleMapsLink }),
        ...(workingHours !== undefined && { workingHours }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...((faqs !== undefined || knowledgeCases !== undefined || faqData !== undefined) && {
          faqData: buildAiConfig({
            faqs: nextFaqs,
            knowledgeCases: nextKnowledgeCases,
          }),
        }),
        ...(aiEnabled !== undefined && { aiEnabled }),
      },
    });

    const aiConfig = getAiConfigFromSettings(settings);

    res.json({
      settings: {
        ...settings,
        faqs: aiConfig.faqs,
        knowledgeCases: aiConfig.knowledgeCases,
      },
    });
  } catch (error) {
    next(error);
  }
};

const preview = async (req, res, next) => {
  try {
    const {
      clinicName,
      clinicNameAr,
      phone,
      address,
      workingHours,
      whatsappChatLink,
      googleMapsLink,
      systemPrompt,
      faqs = [],
      knowledgeCases = [],
      userMessage,
      conversationHistory = [],
    } = req.body;

    if (!String(userMessage || '').trim()) {
      return res.status(400).json({ error: 'رسالة الاختبار مطلوبة' });
    }

    const result = await openaiService.previewInquiryResponse({
      clinicName,
      clinicNameAr,
      phone,
      address,
      workingHours,
      whatsappChatLink,
      googleMapsLink,
      systemPrompt,
      faqs,
      knowledgeCases,
      userMessage,
      conversationHistory,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { get, update, preview, importKnowledgeCases, previewKnowledgeImport };
