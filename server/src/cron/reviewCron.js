const cron = require('node-cron');
const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');

const REVIEW_DELAY_HOURS = Number(process.env.REVIEW_REQUEST_DELAY_HOURS || 24);
const REVIEW_TEMPLATE = 'clinic_review_ar';
const REVIEW_FALLBACK_LANGUAGES = ['ar', 'ar_EG', 'ar_AR', 'ar_SA'];

const resolveTemplateLanguage = async (templateName) => {
  const stored = await prisma.campaignTemplate
    .findUnique({ where: { name: templateName }, select: { languageCode: true } })
    .catch(() => null);
  return stored?.languageCode || 'ar';
};

const sendReviewTemplateWithFallback = async (phone, params) => {
  const primaryLang = await resolveTemplateLanguage(REVIEW_TEMPLATE);
  const tried = new Set();
  const order = [primaryLang, ...REVIEW_FALLBACK_LANGUAGES.filter((lang) => lang !== primaryLang)];

  let lastError = null;
  for (const lang of order) {
    if (tried.has(lang)) continue;
    tried.add(lang);
    try {
      await whatsappService.sendTemplateMessage(phone, REVIEW_TEMPLATE, lang, null, params);
      return lang;
    } catch (error) {
      lastError = error;
      const details = error?.response?.data?.error?.error_data?.details || '';
      if (!/does not exist in/i.test(details)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Review template language not resolved');
};

const sendPendingReviewRequests = async () => {
  const cutoff = new Date(Date.now() - REVIEW_DELAY_HOURS * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'COMPLETED',
      reviewSent: false,
      OR: [
        { completedAt: { lte: cutoff } },
        {
          completedAt: null,
          updatedAt: { lte: cutoff },
        },
      ],
    },
    include: {
      patient: { select: { id: true, name: true, phone: true, platform: true } },
      doctor: { select: { id: true, name: true } },
    },
    take: 20,
  });

  if (appointments.length === 0) return 0;

  let sent = 0;

  for (const appointment of appointments) {
    try {
      if (!appointment.patient?.phone || appointment.patient.platform !== 'WHATSAPP') {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { reviewSent: true },
        });
        continue;
      }

      const patientName = appointment.patient.name || 'عزيزنا المريض';
      const doctorName = (appointment.doctor?.name || 'الطبيب').replace(/^د\.\s*/, '');

      const usedLang = await sendReviewTemplateWithFallback(appointment.patient.phone, [patientName, doctorName]);
      if (usedLang !== 'ar') {
        prisma.campaignTemplate
          .updateMany({ where: { name: REVIEW_TEMPLATE }, data: { languageCode: usedLang } })
          .catch(() => {});
      }

      await prisma.review.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patient.id,
          doctorId: appointment.doctor?.id || appointment.doctorId,
          sentAt: new Date(),
        },
      });

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reviewSent: true },
      });

      sent++;
      console.log(`[ReviewCron] Sent review request to ${appointment.patient.phone}`);
    } catch (error) {
      console.error(`[ReviewCron] Failed to send review for appointment ${appointment.id}:`, error.message);
    }
  }

  return sent;
};

const startReviewCron = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const count = await sendPendingReviewRequests();
      if (count > 0) {
        console.log(`[ReviewCron] Sent ${count} review request(s)`);
      }
    } catch (error) {
      console.error('[ReviewCron] Error:', error.message);
    }
  });

  console.log(`[Cron] Review request cron started (every 15 min, delay ${REVIEW_DELAY_HOURS}h)`);
};

module.exports = { startReviewCron, sendPendingReviewRequests };
