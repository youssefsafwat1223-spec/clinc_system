const cron = require('node-cron');
const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');

const REVIEW_DELAY_HOURS = 3;
const REVIEW_TEMPLATE = 'clinic_review_ar';

/**
 * Find confirmed appointments that ended 3+ hours ago and haven't had a review sent yet.
 * Send a WhatsApp template with rating buttons.
 */
const sendPendingReviewRequests = async () => {
  const cutoff = new Date(Date.now() - REVIEW_DELAY_HOURS * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      reviewSent: false,
      scheduledTime: { lte: cutoff },
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
        // Mark as sent so we don't retry non-WhatsApp patients
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { reviewSent: true },
        });
        continue;
      }

      const patientName = appointment.patient.name || 'عزيزي المريض';
      const doctorName = (appointment.doctor?.name || 'الطبيب').replace(/^د\.\s*/, '');

      // Send the template
      await whatsappService.sendTemplateMessage(
        appointment.patient.phone,
        REVIEW_TEMPLATE,
        'ar',
        null,
        [patientName, doctorName]
      );

      // Create review record (awaiting reply)
      await prisma.review.create({
        data: {
          appointmentId: appointment.id,
          patientId: appointment.patient.id,
          doctorId: appointment.doctor?.id || appointment.doctorId,
          sentAt: new Date(),
        },
      });

      // Mark appointment so we don't send again
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reviewSent: true },
      });

      sent++;
      console.log(`[ReviewCron] Sent review request to ${appointment.patient.phone}`);
    } catch (error) {
      console.error(`[ReviewCron] Failed to send review for appointment ${appointment.id}:`, error.message);
      // Don't mark as sent so we can retry next cycle
    }
  }

  return sent;
};

const startReviewCron = () => {
  // Run every 15 minutes
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

  console.log('[Cron] Review request cron started (every 15 min)');
};

module.exports = { startReviewCron, sendPendingReviewRequests };
