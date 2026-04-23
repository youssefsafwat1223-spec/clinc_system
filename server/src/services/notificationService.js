const prisma = require('../lib/prisma');
const whatsappService = require('./whatsappService');
const messengerService = require('./messengerService');
const instagramService = require('./instagramService');
const { formatDateAr, formatTimeAr } = require('../utils/helpers');

const sendReminders = async (hoursBeforeAppointment = 24) => {
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursBeforeAppointment * 60 * 60 * 1000);
  const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      scheduledTime: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      patient: true,
      doctor: true,
      service: true,
      notifications: true,
    },
  });

  const reminderType = `reminder_${hoursBeforeAppointment}h`;
  let sentCount = 0;

  for (const appointment of upcomingAppointments) {
    const alreadySent = appointment.notifications.some((notification) => notification.type === reminderType);
    if (alreadySent) {
      continue;
    }

    const channel = resolveChannel(appointment.patient);
    if (!channel) {
      continue;
    }

    const reminderText = [
      `تذكير بموعدك بعد ${hoursBeforeAppointment} ساعة`,
      '',
      `الخدمة: ${appointment.service?.nameAr || appointment.service?.name || 'الخدمة'}`,
      `الدكتور: ${appointment.doctor?.name || 'غير محدد'}`,
      `التاريخ: ${formatDateAr(appointment.scheduledTime)}`,
      `الوقت: ${formatTimeAr(appointment.scheduledTime)}`,
    ].join('\n');

    try {
      await sendTextByChannel({
        channel,
        patient: appointment.patient,
        content: reminderText,
      });

      await prisma.notification.create({
        data: {
          appointmentId: appointment.id,
          type: reminderType,
          sentAt: new Date(),
          channel,
        },
      });
      await logOutboundMessageIfNeeded({
        appointment,
        channel,
        content: reminderText,
        metadata: {
          source: 'APPOINTMENT_REMINDER',
          reminderType,
          appointmentId: appointment.id,
        },
      });
      sentCount++;
    } catch (error) {
      console.error(`[Reminder] Failed for appointment ${appointment.id}:`, error.message);
    }
  }

  return sentCount;
};

const buildBookingConfirmationText = (appointment) => {
  const serviceName = appointment.service?.nameAr || appointment.service?.name || 'الخدمة';
  const doctorName = appointment.doctor?.name || 'غير محدد';
  const lines = [
    'تم تأكيد حجزك بنجاح',
    '',
  ];

  if (appointment.bookingRef) {
    lines.push(`كود الحجز: ${appointment.bookingRef}`, '');
  }

  lines.push(
    `الخدمة: ${serviceName}`,
    `الدكتور: ${doctorName}`,
    `التاريخ: ${formatDateAr(appointment.scheduledTime)}`,
    `الوقت: ${formatTimeAr(appointment.scheduledTime)}`,
    '',
    'إذا أردت تعديل الموعد أو إلغاءه، اكتب لنا من نفس المحادثة.'
  );

  return lines.join('\n');
};

const buildBookingRejectedText = (appointment, alternatives = []) => {
  const serviceName = appointment.service?.nameAr || appointment.service?.name || 'الخدمة';
  const baseLines = [
    'تعذر تثبيت الموعد المطلوب.',
    '',
    `الخدمة: ${serviceName}`,
    `السبب: ${appointment.notes || 'تعديل إداري'}`,
  ];

  if (alternatives.length > 0) {
    baseLines.push('', 'المواعيد البديلة المقترحة:');
    alternatives.slice(0, 5).forEach((alternative) => {
      baseLines.push(`- ${alternative.label}`);
    });
  } else {
    baseLines.push('', 'يرجى التواصل معنا لتحديد موعد بديل.');
  }

  return baseLines.join('\n');
};

const resolveChannel = (patient) => {
  if (!patient) {
    return null;
  }

  if (patient.platform === 'FACEBOOK' && (patient.facebookId || patient.phone)) {
    return 'FACEBOOK';
  }

  if (patient.platform === 'INSTAGRAM' && (patient.instagramId || patient.phone)) {
    return 'INSTAGRAM';
  }

  if (patient.phone) {
    return 'WHATSAPP';
  }

  return null;
};

const logOutboundMessageIfNeeded = async ({ appointment, channel, content, metadata }) => {
  if (!appointment?.patientId || channel === 'WHATSAPP') {
    return;
  }

  try {
    await prisma.message.create({
      data: {
        patientId: appointment.patientId,
        platform: channel,
        content,
        type: 'OUTBOUND',
        metadata,
      },
    });
  } catch (error) {
    console.error('[Notification] Failed to store outbound social message:', error.message);
  }
};

const sendTextByChannel = async ({ channel, patient, content }) => {
  switch (channel) {
    case 'WHATSAPP':
      await whatsappService.sendTextMessage(patient.phone, content);
      break;
    case 'FACEBOOK':
      await messengerService.sendTextMessage(patient.facebookId || patient.phone, content);
      break;
    case 'INSTAGRAM':
      await instagramService.sendTextMessage(patient.instagramId || patient.phone, content);
      break;
    default:
      throw new Error('No notification channel available');
  }
};

const createNotificationRecord = async (appointmentId, type, channel) => {
  await prisma.notification.create({
    data: {
      appointmentId,
      type,
      sentAt: new Date(),
      channel,
    },
  });
};

const sendBookingConfirmed = async (appointment) => {
  const channel = resolveChannel(appointment.patient);
  if (!channel) {
    return;
  }

  const content = buildBookingConfirmationText(appointment);
  await sendTextByChannel({
    channel,
    patient: appointment.patient,
    content,
  });

  await logOutboundMessageIfNeeded({
    appointment,
    channel,
    content,
    metadata: {
      source: 'APPOINTMENT_CONFIRMATION',
      appointmentId: appointment.id,
      bookingRef: appointment.bookingRef,
    },
  });

  await createNotificationRecord(appointment.id, 'booking_confirmed', channel);
};

const sendBookingRejected = async (appointment, alternatives = []) => {
  const channel = resolveChannel(appointment.patient);
  if (!channel) {
    return;
  }

  const content = buildBookingRejectedText(appointment, alternatives);
  await sendTextByChannel({
    channel,
    patient: appointment.patient,
    content,
  });

  await logOutboundMessageIfNeeded({
    appointment,
    channel,
    content,
    metadata: {
      source: 'APPOINTMENT_REJECTION',
      appointmentId: appointment.id,
      bookingRef: appointment.bookingRef,
      alternatives,
    },
  });

  await createNotificationRecord(appointment.id, 'booking_rejected', channel);
};

module.exports = {
  sendReminders,
  sendBookingConfirmed,
  sendBookingRejected,
};
