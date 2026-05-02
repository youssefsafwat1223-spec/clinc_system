const prisma = require('../lib/prisma');
const config = require('../config/env');
const whatsappService = require('../services/whatsappService');

const toAbsoluteUrl = (req, url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;

  const baseUrl = (config.dashboardUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return new URL(url, `${baseUrl}/`).toString();
};

const normalizeTemplatePayload = (body) => ({
  name: body.name?.trim(),
  displayName: body.displayName?.trim(),
  category: (body.category || 'MARKETING').trim().toUpperCase(),
  languageCode: (body.languageCode || 'ar').trim(),
  headerType: (body.headerType || 'NONE').trim().toUpperCase(),
  bodyText: body.bodyText?.trim() || null,
  footerText: body.footerText?.trim() || null,
  imageUrl: body.imageUrl?.trim() || null,
  active: body.active !== undefined ? Boolean(body.active) : true,
});

const listTemplates = async (req, res, next) => {
  try {
    const templates = await prisma.campaignTemplate.findMany({
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ templates });
  } catch (error) {
    next(error);
  }
};

const createTemplate = async (req, res, next) => {
  try {
    const data = normalizeTemplatePayload(req.body);

    if (!data.name || !data.displayName) {
      return res.status(400).json({ error: 'اسم القالب واسم العرض مطلوبان' });
    }

    if (data.headerType === 'IMAGE' && !data.imageUrl) {
      return res.status(400).json({ error: 'ارفع صورة للقالب الذي يحتوي على Header Image' });
    }

    const template = await prisma.campaignTemplate.create({ data });
    res.status(201).json({ template });
  } catch (error) {
    next(error);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const data = normalizeTemplatePayload(req.body);

    if (!data.name || !data.displayName) {
      return res.status(400).json({ error: 'اسم القالب واسم العرض مطلوبان' });
    }

    if (data.headerType === 'IMAGE' && !data.imageUrl) {
      return res.status(400).json({ error: 'ارفع صورة للقالب الذي يحتوي على Header Image' });
    }

    const template = await prisma.campaignTemplate.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ template });
  } catch (error) {
    next(error);
  }
};

const removeTemplate = async (req, res, next) => {
  try {
    await prisma.campaignTemplate.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم حذف القالب بنجاح' });
  } catch (error) {
    next(error);
  }
};

const buildAudienceWhere = async ({ audience, patientIds, filters }) => {
  const baseWhere = { platform: 'WHATSAPP', phone: { not: '' } };

  if (audience === 'SELECTED') {
    const ids = Array.isArray(patientIds) ? patientIds.filter(Boolean) : [];
    if (!ids.length) {
      return null;
    }
    return { ...baseWhere, id: { in: ids } };
  }

  if (audience === 'FILTERED') {
    const { doctorId, serviceId, lastVisitFrom, lastVisitTo, chatState, groupId } = filters || {};

    const appointmentWhere = {};
    if (doctorId) appointmentWhere.doctorId = doctorId;
    if (serviceId) appointmentWhere.serviceId = serviceId;

    if (lastVisitFrom || lastVisitTo) {
      appointmentWhere.scheduledTime = {};
      if (lastVisitFrom) appointmentWhere.scheduledTime.gte = new Date(lastVisitFrom);
      if (lastVisitTo) {
        const end = new Date(lastVisitTo);
        end.setHours(23, 59, 59, 999);
        appointmentWhere.scheduledTime.lte = end;
      }
    }

    const hasAppointmentFilter = Object.keys(appointmentWhere).length > 0;
    const where = { ...baseWhere };

    if (hasAppointmentFilter) {
      const matchedAppointments = await prisma.appointment.findMany({
        where: appointmentWhere,
        select: { patientId: true },
        distinct: ['patientId'],
      });
      const ids = matchedAppointments.map((item) => item.patientId);
      if (!ids.length) {
        return null;
      }
      where.id = { in: ids };
    }

    if (chatState) {
      where.chatState = chatState;
    }

    if (groupId) {
      where.groups = { some: { groupId } };
    }

    return where;
  }

  return baseWhere;
};

const normalizeExternalRecipients = (recipients) => {
  if (!Array.isArray(recipients)) return [];

  const seen = new Set();
  return recipients
    .map((item) => ({
      phone: String(item?.phone || '').replace(/[^\d+]/g, '').trim(),
      name: String(item?.name || '').trim(),
    }))
    .filter((item) => {
      if (!item.phone || item.phone.length < 8 || seen.has(item.phone)) return false;
      seen.add(item.phone);
      return true;
    });
};

const sendBroadcast = async (req, res, next) => {
  try {
    const {
      platform = 'WHATSAPP',
      audience = 'ALL',
      patientIds,
      filters,
      messageText,
      broadcastType = 'TEXT',
      templateId,
      templateName,
      templateBodyParams,
      templateBodyNamedParams,
      imageUrl,
      externalRecipients,
    } = req.body;

    if (broadcastType === 'TEXT' && !messageText?.trim()) {
      return res.status(400).json({ error: 'يرجى إدخال نص الرسالة' });
    }

    if (platform !== 'WHATSAPP') {
      return res.status(400).json({ error: 'الحملات متاحة للواتساب فقط حالياً' });
    }

    if (!['ALL', 'SELECTED', 'FILTERED'].includes(audience)) {
      return res.status(400).json({ error: 'نوع الجمهور غير مدعوم' });
    }

    let selectedTemplate = null;
    if (broadcastType === 'TEMPLATE') {
      if (templateId) {
        selectedTemplate = await prisma.campaignTemplate.findUnique({ where: { id: templateId } });
      } else if (templateName?.trim()) {
        selectedTemplate = await prisma.campaignTemplate.findUnique({ where: { name: templateName.trim() } });
      }

      if (!selectedTemplate && !templateName?.trim()) {
        return res.status(400).json({ error: 'اختر قالباً محفوظاً قبل الإرسال' });
      }
    }

    const importedRecipients = normalizeExternalRecipients(externalRecipients);
    let audienceWhere = null;
    let patients = importedRecipients;

    if (!patients.length) {
      audienceWhere = await buildAudienceWhere({ audience, patientIds, filters });
    }
    if (!patients.length && !audienceWhere) {
      return res.status(400).json({ error: 'لا يوجد مرضى مطابقين للفلاتر المحددة' });
    }

    if (!patients.length) {
      patients = await prisma.patient.findMany({
        where: audienceWhere,
        select: { id: true, phone: true, name: true },
      });
    }

    if (patients.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مرضى متطابقين في قاعدة البيانات' });
    }

    const resolvedTemplateName = selectedTemplate?.name || templateName?.trim();
    const resolvedLanguageCode = selectedTemplate?.languageCode || 'ar';
    const resolvedImageUrl = toAbsoluteUrl(req, selectedTemplate?.imageUrl || imageUrl);

    let successCount = 0;
    let failCount = 0;

    const personalizeParam = (value, patient) => {
      if (typeof value !== 'string') return value;
      return value
        .replace(/\{\{name\}\}/gi, patient.name || 'عميلنا')
        .replace(/\{\{phone\}\}/gi, patient.phone || '');
    };

    const sanitizedBodyParams = Array.isArray(templateBodyParams)
      ? templateBodyParams.map((value) => (value === null || value === undefined ? '' : String(value)))
      : [];

    const sanitizedNamedParams = Array.isArray(templateBodyNamedParams)
      ? templateBodyNamedParams
          .filter((item) => item?.name)
          .map((item) => ({
            name: String(item.name),
            value: item.value === null || item.value === undefined ? '' : String(item.value),
          }))
      : [];

    for (const patient of patients) {
      try {
        if (broadcastType === 'TEMPLATE') {
          const params = [
            ...sanitizedBodyParams.map((value) => personalizeParam(value, patient)),
            ...sanitizedNamedParams.map((item) => ({
              name: item.name,
              text: personalizeParam(item.value, patient),
            })),
          ];

          if (resolvedTemplateName === 'clinic_offer_text_ar' && params.length === 0) {
            params.push(patient.name || 'عميلنا');
          }

          await whatsappService.sendTemplateMessage(
            patient.phone,
            resolvedTemplateName,
            resolvedLanguageCode,
            resolvedImageUrl,
            params
          );
        } else {
          const personalizedMsg = messageText.replace(/{{name}}/g, patient.name);
          await whatsappService.sendTextMessage(patient.phone, personalizedMsg);
        }

        successCount++;
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to send broadcast to ${patient.phone}:`, error.message);
        failCount++;
      }
    }

    res.json({
      success: true,
      summary: `تم الإرسال لعدد ${successCount} مريض، وفشل ${failCount}.`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  removeTemplate,
  sendBroadcast,
};
