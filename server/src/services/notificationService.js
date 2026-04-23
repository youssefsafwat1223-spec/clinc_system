const prisma = require('../lib/prisma');
const whatsappService = require('./whatsappService');
const messengerService = require('./messengerService');
const instagramService = require('./instagramService');
const { formatDateAr, formatTimeAr } = require('../utils/helpers');

const WHATSAPP_TEMPLATES = {
  bookingConfirmed: 'booking_confirmed_ar_v2',
  bookingRejected: 'booking_rejected_ar_v2',
  bookingRejectedWithAlternatives: 'booking_rejected_with_alternatives_ar_v2',
  appointmentReminder: 'appointment_reminder_ar_v2',
};

const CARE_WINDOW_HOURS = 24;

const getServiceName = (appointment) => appointment.service?.nameAr || appointment.service?.name || 'الخدمة';
const getDoctorName = (appointment) => appointment.doctor?.name || 'غير محدد';

const isWithinWhatsAppCareWindow = async (patientId) => {
  if (!patientId) {
    return false;
  }

  const since = new Date(Date.now() - CARE_WINDOW_HOURS * 60 * 60 * 1000);
  const inboundMessage = await prisma.message.findFirst({
    where: {
      patientId,
      platform: 'WHATSAPP',
      type: 'INBOUND',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return Boolean(inboundMessage);
};

const sendWhatsAppTextOrTemplate = async ({
  patient,
  textContent,
  templateName,
  bodyParams = [],
}) => {
  const withinWindow = await isWithinWhatsAppCareWindow(patient.id);

  if (withinWindow) {
    await whatsappService.sendTextMessage(patient.phone, textContent);
    return { mode: 'text', content: textContent };
  }

  await whatsappService.sendTemplateMessage(patient.phone, templateName, 'ar', null, bodyParams);
  return { mode: 'template', content: textContent };
};

const buildReminderText = (appointment) => [
  '🔔 تذكير بموعدك',
  '',
  `مرحبًا ${appointment.patient?.name || 'عزيزي المريض'}،`,
  `تذكير بموعدك يوم ${formatDateAr(appointment.scheduledTime)} الساعة ${formatTimeAr(appointment.scheduledTime)}.`,
  '',
  `👨‍⚕️ الدكتور: ${getDoctorName(appointment)}`,
  `📋 الخدمة: ${getServiceName(appointment)}`,
  '',
  'نتطلع لرؤيتك! 😊',
].join('\n');

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

    const reminderText = buildReminderText(appointment);

    try {
      if (channel === 'WHATSAPP') {
        await sendWhatsAppTextOrTemplate({
          patient: appointment.patient,
          textContent: reminderText,
          templateName: WHATSAPP_TEMPLATES.appointmentReminder,
          bodyParams: [
            appointment.patient?.name || 'عزيزي المريض',
            formatDateAr(appointment.scheduledTime),
            formatTimeAr(appointment.scheduledTime),
            getDoctorName(appointment),
            getServiceName(appointment),
          ],
        });
      } else {
        await sendTextByChannel({
          channel,
          patient: appointment.patient,
          content: reminderText,
        });
      }

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
  const lines = ['✅ تم تأكيد حجزك بنجاح!', ''];

  if (appointment.bookingRef) {
    lines.push(`رقم الحجز: *${appointment.bookingRef}*`, '');
  }

  lines.push(
    `📋 الخدمة: ${getServiceName(appointment)}`,
    `👨‍⚕️ الدكتور: ${getDoctorName(appointment)}`,
    `📅 الموعد: ${formatDateAr(appointment.scheduledTime)}`,
    `⏰ الوقت: ${formatTimeAr(appointment.scheduledTime)}`,
    '',
    'سنرسل لك تذكير قبل الموعد. شكراً لك! 🙏'
  );

  return lines.join('\n');
};

const buildBookingRejectedText = (appointment, alternatives = []) => {
  const baseLines = [
    'تعذر تثبيت الموعد المطلوب.',
    '',
    `الخدمة: ${getServiceName(appointment)}`,
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
  if (channel === 'WHATSAPP') {
    await sendWhatsAppTextOrTemplate({
      patient: appointment.patient,
      textContent: content,
      templateName: WHATSAPP_TEMPLATES.bookingConfirmed,
      bodyParams: [
        appointment.bookingRef || '-',
        getServiceName(appointment),
        getDoctorName(appointment),
        formatDateAr(appointment.scheduledTime),
        formatTimeAr(appointment.scheduledTime),
      ],
    });
  } else {
    await sendTextByChannel({
      channel,
      patient: appointment.patient,
      content,
    });
  }

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
  if (channel === 'WHATSAPP') {
    const normalizedAlternatives = alternatives
      .map((alternative) => alternative?.label)
      .filter(Boolean)
      .slice(0, 3);

    const templateName =
      normalizedAlternatives.length >= 3
        ? WHATSAPP_TEMPLATES.bookingRejectedWithAlternatives
        : WHATSAPP_TEMPLATES.bookingRejected;

    const bodyParams =
      normalizedAlternatives.length >= 3
        ? [
            getServiceName(appointment),
            appointment.notes || 'تعديل إداري',
            normalizedAlternatives[0],
            normalizedAlternatives[1],
            normalizedAlternatives[2],
          ]
        : [getServiceName(appointment), appointment.notes || 'تعديل إداري'];

    await sendWhatsAppTextOrTemplate({
      patient: appointment.patient,
      textContent: content,
      templateName,
      bodyParams,
    });
  } else {
    await sendTextByChannel({
      channel,
      patient: appointment.patient,
      content,
    });
  }

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
