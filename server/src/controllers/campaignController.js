const prisma = require('../lib/prisma');
const config = require('../config/env');
const whatsappService = require('../services/whatsappService');
const manychatService = require('../services/manychatService');

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

const sendOffers = async (req, res, next) => {
  try {
    const reviewerIds = Array.isArray(req.body.reviewerIds) ? req.body.reviewerIds.filter(Boolean) : [];
    const platform = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(req.body.platform) ? req.body.platform : 'WHATSAPP';
    const message = String(req.body.message || '').trim();
    const templateName = String(req.body.templateName || 'clinic_custom_message_ar').trim();
    const imageUrl = toAbsoluteUrl(req, String(req.body.imageUrl || '').trim());
    const serviceId = req.body.serviceId ? String(req.body.serviceId) : null;
    const offerDraftId = req.body.offerDraftId ? String(req.body.offerDraftId) : null;
    const sentById = req.user?.id || null;
    const offerLogs = [];
    const allowedTemplates = ['clinic_custom_message_ar', 'clinic_offer_text_ar', 'clinic_offer_image_ar'];

    if (!reviewerIds.length) return res.status(400).json({ error: 'اختر مراجعين للإرسال' });
    if (!message && templateName !== 'clinic_offer_image_ar') return res.status(400).json({ error: 'نص العرض مطلوب' });
    if (!allowedTemplates.includes(templateName)) return res.status(400).json({ error: 'قالب العرض غير مدعوم' });
    if (templateName === 'clinic_offer_image_ar' && !imageUrl) return res.status(400).json({ error: 'رابط الصورة مطلوب لقالب العرض بصورة' });

    const patients = await prisma.patient.findMany({
      where: {
        id: { in: reviewerIds },
        platform,
        ...(platform === 'WHATSAPP' ? { phone: { not: '' } } : {}),
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        phone: true,
        platform: true,
        manychatSubscriberId: true,
        manychatContactId: true,
        facebookId: true,
        instagramId: true,
      },
    });

    let successCount = 0;
    let failCount = 0;
    let skippedCount = reviewerIds.length - patients.length;
    const failures = [];
    const skipped = [];

    for (const patient of patients) {
      try {
        const patientName = patient.displayName || patient.name || 'عميلنا';
        const body = message
          .replace(/\{\{name\}\}/g, patientName)
          .replace(/\{\{phone\}\}/g, patient.phone || '');

        if (platform === 'WHATSAPP') {
          const bodyParams = templateName === 'clinic_offer_image_ar' ? [] : [patientName, body];
          await whatsappService.sendTemplateMessage(
            patient.phone,
            templateName,
            'ar',
            templateName === 'clinic_offer_image_ar' ? imageUrl : null,
            bodyParams
          );
        } else {
          const subscriberId =
            patient.manychatSubscriberId ||
            patient.manychatContactId ||
            (platform === 'FACEBOOK' ? patient.facebookId : patient.instagramId);

          if (!subscriberId) {
            skippedCount++;
            skipped.push({ patientId: patient.id, reason: 'missing_manychat_subscriber_id' });
            offerLogs.push({
              patientId: patient.id,
              templateName,
              channel: platform,
              serviceId,
              offerDraftId,
              status: 'SKIPPED',
              message: message || null,
              sentById,
            });
            continue;
          }

          await manychatService.sendContent({
            subscriberId,
            platform,
            text:
              templateName === 'clinic_offer_image_ar'
                ? 'يسر عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان تقديم عرض خاص وخدمات مميزة. للحجز أو الاستفسار تواصل معنا الآن.'
                : body,
            imageUrl: templateName === 'clinic_offer_image_ar' ? imageUrl : '',
          });
        }
        successCount++;
        offerLogs.push({
          patientId: patient.id,
          templateName,
          channel: platform,
          serviceId,
          offerDraftId,
          status: 'SENT',
          message: message || null,
          sentById,
        });
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch (error) {
        failCount++;
        failures.push({ patientId: patient.id, phone: patient.phone, error: error.message });
        offerLogs.push({
          patientId: patient.id,
          templateName,
          channel: platform,
          serviceId,
          offerDraftId,
          status: 'FAILED',
          message: message || null,
          sentById,
        });
      }
    }

    // Best-effort logging — must never break the send response.
    if (offerLogs.length) {
      try {
        await prisma.offerLog.createMany({ data: offerLogs });
      } catch (logError) {
        console.error('OfferLog write failed:', logError.message);
      }
    }

    res.json({ success: true, successCount, failCount, skippedCount, failures, skipped });
  } catch (error) {
    next(error);
  }
};

const listSegments = async (req, res, next) => {
  try {
    const {
      platform = 'WHATSAPP',
      search,
      serviceId,
      segment = 'ALL',
      templateName,
      offerDraftId,
      excludeAlreadySent,
      limit = 500,
    } = req.query;
    const normalizedPlatform = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'].includes(platform) ? platform : 'WHATSAPP';
    const filters = [{ platform: normalizedPlatform }];

    if (search) {
      filters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      });
    }

    if (segment === 'CONTACT_ONLY') filters.push({ appointments: { none: {} } });
    if (segment === 'BOOKED_ANY') filters.push({ appointments: { some: {} } });
    if (segment === 'BOOKED_SERVICE') {
      filters.push(serviceId ? { appointments: { some: { serviceId } } } : { appointments: { some: {} } });
    }
    if (segment === 'NOT_BOOKED_SERVICE' && serviceId) filters.push({ appointments: { none: { serviceId } } });

    // When an exact saved draft is given, scope strictly by offerDraftId so
    // two drafts using the same template are tracked separately.
    const offerScope = offerDraftId
      ? { offerDraftId }
      : {
          ...(templateName ? { templateName } : {}),
          ...(serviceId ? { serviceId } : {}),
        };
    if (segment === 'OFFER_SENT') {
      filters.push({ offerLogs: { some: { ...offerScope, status: 'SENT' } } });
    }
    if (segment === 'OFFER_NOT_SENT') {
      filters.push({ offerLogs: { none: { ...offerScope, status: 'SENT' } } });
    }
    if (String(excludeAlreadySent) === 'true' && segment !== 'OFFER_NOT_SENT') {
      filters.push({ offerLogs: { none: { ...offerScope, status: 'SENT' } } });
    }

    const patients = await prisma.patient.findMany({
      where: { AND: filters },
      take: Math.min(Number(limit) || 500, 1000),
      orderBy: { createdAt: 'desc' },
      include: {
        groups: { include: { group: true } },
        _count: { select: { appointments: true, messages: true } },
      },
    });

    res.json({ patients });
  } catch (error) {
    next(error);
  }
};
const ALLOWED_OFFER_TEMPLATES = ['clinic_custom_message_ar', 'clinic_offer_text_ar', 'clinic_offer_image_ar'];

const listOfferDrafts = async (req, res, next) => {
  try {
    const { templateName } = req.query;
    const drafts = await prisma.offerDraft.findMany({
      where: templateName ? { templateName } : {},
      orderBy: { createdAt: 'desc' },
      include: { service: true },
    });
    res.json({ drafts });
  } catch (error) {
    next(error);
  }
};

const createOfferDraft = async (req, res, next) => {
  try {
    const { title, templateName, bodyText, imageUrl, serviceId, channel } = req.body;
    if (!String(title || '').trim()) return res.status(400).json({ error: 'اسم العرض مطلوب' });
    if (!ALLOWED_OFFER_TEMPLATES.includes(templateName)) {
      return res.status(400).json({ error: 'قالب العرض غير مدعوم' });
    }
    const draft = await prisma.offerDraft.create({
      data: {
        title: String(title).trim(),
        templateName,
        bodyText: bodyText ? String(bodyText) : null,
        imageUrl: imageUrl ? String(imageUrl) : null,
        serviceId: serviceId || null,
        channel: channel || null,
        createdById: req.user?.id || null,
      },
      include: { service: true },
    });
    res.status(201).json({ draft });
  } catch (error) {
    next(error);
  }
};

const updateOfferDraft = async (req, res, next) => {
  try {
    const existing = await prisma.offerDraft.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'العرض المحفوظ غير موجود' });
    const { title, templateName, bodyText, imageUrl, serviceId, channel } = req.body;
    if (templateName !== undefined && !ALLOWED_OFFER_TEMPLATES.includes(templateName)) {
      return res.status(400).json({ error: 'قالب العرض غير مدعوم' });
    }
    const draft = await prisma.offerDraft.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(templateName !== undefined && { templateName }),
        ...(bodyText !== undefined && { bodyText: bodyText ? String(bodyText) : null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl ? String(imageUrl) : null }),
        ...(serviceId !== undefined && { serviceId: serviceId || null }),
        ...(channel !== undefined && { channel: channel || null }),
      },
      include: { service: true },
    });
    res.json({ draft });
  } catch (error) {
    next(error);
  }
};

const deleteOfferDraft = async (req, res, next) => {
  try {
    const existing = await prisma.offerDraft.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'العرض المحفوظ غير موجود' });
    await prisma.offerDraft.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  removeTemplate,
  listSegments,
  sendBroadcast,
  sendOffers,
  listOfferDrafts,
  createOfferDraft,
  updateOfferDraft,
  deleteOfferDraft,
};
