const prisma = require('../lib/prisma');
const whatsappService = require('./whatsappService');
const messengerService = require('./messengerService');
const instagramService = require('./instagramService');
const {
  formatDateAr,
  formatDayNameAr,
  formatTimeAr,
  formatDateKey,
  normalizeWorkingPeriods,
} = require('../utils/helpers');

const WHATSAPP_TEMPLATES = {
  bookingConfirmed: 'booking_confirmed_ar_v2',
  bookingRejected: 'booking_rejected_ar_v2',
  bookingRejectedWithAlternatives: 'booking_rejected_with_alternatives_ar_v2',
  bookingCancelled: 'booking_cancelled_ar_v2',
  appointmentReminder: 'appointment_reminder_ar_v2',
  appointmentReminderV3: 'appointment_reminder_ar_v3',
  doctorRescheduled: 'doctor_reschedule_ar_v1',
};

const CARE_WINDOW_HOURS = 24;
const WALK_IN_REMINDER_LEAD_HOURS = Number(process.env.WALK_IN_REMINDER_LEAD_HOURS || 1);
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_REMINDER_OPENING_TIME = process.env.DEFAULT_REMINDER_OPENING_TIME || '3:00 PM';

const getServiceName = (appointment) => appointment.service?.nameAr || appointment.service?.name || 'الخدمة';
const getDoctorName = (appointment) => appointment.doctor?.name || 'غير محدد';

const resolveChannel = (patient) => {
  if (!patient) return null;
  if (patient.platform === 'FACEBOOK' && (patient.facebookId || patient.phone)) return 'FACEBOOK';
  if (patient.platform === 'INSTAGRAM' && (patient.instagramId || patient.phone)) return 'INSTAGRAM';
  if (patient.phone) return 'WHATSAPP';
  return null;
};

const isWithinWhatsAppCareWindow = async (patientId) => {
  if (!patientId) return false;

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

const sendWhatsAppTextOrTemplate = async ({ patient, textContent, templateName, bodyParams = [] }) => {
  const withinWindow = await isWithinWhatsAppCareWindow(patient.id);

  if (withinWindow) {
    await whatsappService.sendTextMessage(patient.phone, textContent);
    return { mode: 'text', content: textContent };
  }

  await whatsappService.sendTemplateMessage(patient.phone, templateName, 'ar', null, bodyParams);
  return { mode: 'template', content: textContent };
};

const logOutboundMessageIfNeeded = async ({ appointment, channel, content, metadata }) => {
  if (!appointment?.patientId || channel === 'WHATSAPP') return;

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

const resolveReminderWorkingHours = (appointment, clinicWorkingHours = {}) => {
  const doctorHours = appointment.doctor?.workingHours;
  return doctorHours && Object.keys(doctorHours || {}).length > 0 ? doctorHours : clinicWorkingHours || {};
};

const getDayOpeningTime = (date, workingHours = {}) => {
  const target = new Date(date);
  const dayKey = DAY_NAMES[target.getDay()];
  const periods = normalizeWorkingPeriods(workingHours?.[dayKey]);
  if (periods.length === 0) return null;

  const firstPeriod = periods
    .slice()
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))[0];

  const [startHour, startMinute] = String(firstPeriod.start).split(':').map(Number);
  if (!Number.isFinite(startHour) || !Number.isFinite(startMinute)) return null;

  const opening = new Date(target);
  opening.setHours(startHour, startMinute, 0, 0);
  return opening;
};

const getReminderOpeningTime = (appointment, clinicWorkingHours = {}) => {
  const openingTime = getDayOpeningTime(
    appointment.scheduledTime,
    resolveReminderWorkingHours(appointment, clinicWorkingHours)
  );
  return openingTime || DEFAULT_REMINDER_OPENING_TIME;
};

const formatReminderOpeningTime = (openingTime) =>
  typeof openingTime === 'string' ? openingTime : formatTimeAr(openingTime);

const buildGeneralOpeningReminderText = (appointment, openingTime, title = 'تذكير بموعدك') =>
  [
    title,
    '',
    `مرحباً ${appointment.patient?.displayName || appointment.patient?.name || 'عزيزنا المريض'}،`,
    `موعدك يوم ${formatDayNameAr(appointment.scheduledTime)} الموافق ${formatDateAr(appointment.scheduledTime)}.`,
    `تفتح العيادة الساعة ${formatReminderOpeningTime(openingTime)}، والاستقبال بالترتيب حسب الحضور.`,
    'يرجى العلم أن هذا وقت فتح العيادة وليس موعدًا محددًا خاصًا بك.',
    '',
    `الطبيب: ${getDoctorName(appointment)}`,
    `الخدمة: ${getServiceName(appointment)}`,
    '',
    'لأي استفسار أو تعديل تواصل معنا.',
  ].join('\n');

const sendAppointmentReminderTemplate = async ({ appointment, patient, reminderText, openingTime }) => {
  const canUseV3 = process.env.APPOINTMENT_REMINDER_V3_ENABLED === 'true';
  const v3Params = [
    patient?.displayName || patient?.name || 'عزيزنا المريض',
    formatDayNameAr(appointment.scheduledTime),
    formatDateAr(appointment.scheduledTime),
    formatReminderOpeningTime(openingTime),
  ];

  if (canUseV3) {
    try {
      await sendWhatsAppTextOrTemplate({
        patient,
        textContent: reminderText,
        templateName: WHATSAPP_TEMPLATES.appointmentReminderV3,
        bodyParams: v3Params,
      });
      return 'appointmentReminderV3';
    } catch (error) {
      console.error(`[Reminder] V3 template failed for appointment ${appointment.id}. Fallback to v2.`, error.message);
    }
  }

  await sendWhatsAppTextOrTemplate({
    patient,
    textContent: reminderText,
    templateName: WHATSAPP_TEMPLATES.appointmentReminder,
    bodyParams: [formatDateAr(appointment.scheduledTime), formatTimeAr(appointment.scheduledTime)],
  });
  return 'appointmentReminderV2';
};

const buildReminderText = (appointment) =>
  [
    'تذكير بموعدك',
    '',
    `مرحباً ${appointment.patient?.name || 'عزيزنا المريض'}،`,
    `نذكرك بموعدك يوم ${formatDateAr(appointment.scheduledTime)} الساعة ${formatTimeAr(appointment.scheduledTime)}.`,
    '',
    `الطبيب: ${getDoctorName(appointment)}`,
    `الخدمة: ${getServiceName(appointment)}`,
    '',
    'نتطلع لرؤيتك.',
  ].join('\n');

const buildWalkInReminderText = (appointment, openingTime) =>
  [
    'تذكير بحجزك اليوم',
    '',
    `مرحباً ${appointment.patient?.name || 'عزيزنا المريض'}،`,
    `نذكرك بحجزك اليوم ${formatDateAr(appointment.scheduledTime)}.`,
    `يبدأ استقبال المراجعين من الساعة ${formatTimeAr(openingTime)}.`,
    '',
    `الطبيب: ${getDoctorName(appointment)}`,
    `الخدمة: ${getServiceName(appointment)}`,
    '',
    'ملاحظة: الدخول حسب أسبقية الحضور، والشخص الذي يصل أولاً يدخل أولاً.',
  ].join('\n');

const sendReminders = async (hoursBeforeAppointment = 24) => {
  const settings = await prisma.clinicSettings.findFirst({
    select: { workingHours: true },
  });
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursBeforeAppointment * 60 * 60 * 1000);
  const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);

  const upcomingAppointments = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      appointmentType: 'SCHEDULED',
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
    if (alreadySent) continue;

    const channel = resolveChannel(appointment.patient);
    if (!channel) continue;

    const openingTime = getReminderOpeningTime(appointment, settings?.workingHours || {});
    const reminderText = buildGeneralOpeningReminderText(appointment, openingTime);

    try {
      let templateUsed = null;
      if (channel === 'WHATSAPP') {
        templateUsed = await sendAppointmentReminderTemplate({
          appointment,
          patient: appointment.patient,
          reminderText,
          openingTime,
        });
      } else {
        await sendTextByChannel({ channel, patient: appointment.patient, content: reminderText });
      }

      await createNotificationRecord(appointment.id, reminderType, channel);
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

const sendWalkInRemindersBeforeOpening = async () => {
  const settings = await prisma.clinicSettings.findFirst({
    select: { workingHours: true },
  });

  const today = new Date();
  const todayKey = formatDateKey(today);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'CONFIRMED',
      appointmentType: 'WALK_IN',
      scheduledTime: {
        gte: new Date(`${todayKey}T00:00:00`),
        lt: new Date(`${todayKey}T23:59:59.999`),
      },
    },
    include: {
      patient: true,
      doctor: true,
      service: true,
      notifications: true,
    },
  });

  if (appointments.length === 0) return 0;

  let sentCount = 0;
  for (const appointment of appointments) {
    const reminderType = `walkin_preopen_${todayKey}`;
    const alreadySent = appointment.notifications.some((notification) => notification.type === reminderType);
    if (alreadySent) continue;

    const workingHours = resolveReminderWorkingHours(appointment, settings?.workingHours || {});
    const openingTime = getDayOpeningTime(appointment.scheduledTime, workingHours);
    if (!openingTime) continue;

    const reminderTime = new Date(openingTime.getTime() - WALK_IN_REMINDER_LEAD_HOURS * 60 * 60 * 1000);
    const windowStart = new Date(reminderTime.getTime() - 15 * 60 * 1000);
    const windowEnd = new Date(reminderTime.getTime() + 15 * 60 * 1000);
    const now = new Date();

    if (now < windowStart || now > windowEnd) continue;

    const channel = resolveChannel(appointment.patient);
    if (!channel) continue;

    const reminderText = buildWalkInReminderText(appointment, openingTime);

    try {
      if (channel === 'WHATSAPP') {
        await sendWhatsAppTextOrTemplate({
          patient: appointment.patient,
          textContent: reminderText,
          templateName: WHATSAPP_TEMPLATES.appointmentReminder,
          bodyParams: [
            appointment.patient?.name || 'عزيزنا المريض',
            formatDateAr(appointment.scheduledTime),
            formatTimeAr(openingTime),
            getDoctorName(appointment),
            getServiceName(appointment),
          ],
        });
      } else {
        await sendTextByChannel({ channel, patient: appointment.patient, content: reminderText });
      }

      await createNotificationRecord(appointment.id, reminderType, channel);
      await logOutboundMessageIfNeeded({
        appointment,
        channel,
        content: reminderText,
        metadata: {
          source: 'WALK_IN_REMINDER',
          reminderType,
          appointmentId: appointment.id,
          openingTime: openingTime.toISOString(),
        },
      });
      sentCount++;
    } catch (error) {
      console.error(`[WalkInReminder] Failed for appointment ${appointment.id}:`, error.message);
    }
  }

  return sentCount;
};

const buildBookingConfirmationText = (appointment) => {
  const lines = ['تم تأكيد حجزك بنجاح.', ''];

  if (appointment.bookingRef) {
    lines.push(`رقم الحجز: *${appointment.bookingRef}*`, '');
  }

  lines.push(
    `الخدمة: ${getServiceName(appointment)}`,
    `الطبيب: ${getDoctorName(appointment)}`,
    `التاريخ: ${formatDateAr(appointment.scheduledTime)}`,
    `الوقت: ${formatTimeAr(appointment.scheduledTime)}`,
    '',
    'سنرسل لك تذكيراً قبل الموعد. شكراً لك.'
  );

  return lines.join('\n');
};

const buildWalkInConfirmationText = (appointment) =>
  [
    'تم تأكيد حجزك بنجاح.',
    '',
    appointment.bookingRef ? `رقم الحجز: *${appointment.bookingRef}*` : null,
    `الخدمة: ${getServiceName(appointment)}`,
    `الطبيب: ${getDoctorName(appointment)}`,
    `التاريخ: ${formatDateAr(appointment.scheduledTime)}`,
    '',
    'ملاحظة: الدخول حسب أسبقية الحضور، والشخص الذي يصل أولاً يدخل أولاً.',
  ]
    .filter(Boolean)
    .join('\n');

const sendBookingConfirmed = async (appointment) => {
  const channel = resolveChannel(appointment.patient);
  if (!channel) return;

  const content =
    appointment.appointmentType === 'WALK_IN'
      ? buildWalkInConfirmationText(appointment)
      : buildBookingConfirmationText(appointment);

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
        appointment.appointmentType === 'WALK_IN'
          ? 'الدخول حسب أسبقية الحضور'
          : formatTimeAr(appointment.scheduledTime),
      ],
    });
  } else {
    await sendTextByChannel({ channel, patient: appointment.patient, content });
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

const sendBookingRejected = async (appointment, alternatives = []) => {
  const channel = resolveChannel(appointment.patient);
  if (!channel) return;

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
    await sendTextByChannel({ channel, patient: appointment.patient, content });
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

const buildBookingCancelledText = (appointment, reason) =>
  [
    'تم إلغاء حجزك.',
    '',
    appointment.bookingRef ? `رقم الحجز: *${appointment.bookingRef}*` : null,
    `الخدمة: ${getServiceName(appointment)}`,
    `الطبيب: ${getDoctorName(appointment)}`,
    `التاريخ: ${formatDateAr(appointment.scheduledTime)}`,
    appointment.appointmentType === 'SCHEDULED' ? `الوقت: ${formatTimeAr(appointment.scheduledTime)}` : null,
    '',
    reason ? `السبب: ${reason}` : 'تم الإلغاء بناءً على طلب إداري.',
    '',
    'يسعدنا خدمتك في أي وقت لحجز موعد جديد.',
  ]
    .filter(Boolean)
    .join('\n');

const sendBookingCancelled = async (appointment, reason) => {
  const channel = resolveChannel(appointment.patient);
  if (!channel) return;

  const content = buildBookingCancelledText(appointment, reason);
  const cancellationReason = reason || 'إلغاء الحجز';

  if (channel === 'WHATSAPP') {
    const appointmentSummary =
      appointment.appointmentType === 'WALK_IN'
        ? `${getServiceName(appointment)} مع د. ${getDoctorName(appointment)} يوم ${formatDateAr(appointment.scheduledTime)}`
        : `${getServiceName(appointment)} مع د. ${getDoctorName(appointment)} يوم ${formatDateAr(appointment.scheduledTime)} الساعة ${formatTimeAr(appointment.scheduledTime)}`;
    await sendWhatsAppTextOrTemplate({
      patient: appointment.patient,
      textContent: content,
      templateName: WHATSAPP_TEMPLATES.bookingCancelled,
      bodyParams: [appointment.bookingRef || '-', appointmentSummary],
    });
  } else {
    await sendTextByChannel({ channel, patient: appointment.patient, content });
  }

  await logOutboundMessageIfNeeded({
    appointment,
    channel,
    content,
    metadata: {
      source: 'APPOINTMENT_CANCELLATION',
      appointmentId: appointment.id,
      bookingRef: appointment.bookingRef,
      reason: cancellationReason,
    },
  });

  await createNotificationRecord(appointment.id, 'booking_cancelled', channel);
};

const buildDoctorRescheduledText = (appointment, fromDoctor, toDoctor) =>
  [
    'تم تحديث طبيب موعدك.',
    '',
    appointment.bookingRef ? `رقم الحجز: *${appointment.bookingRef}*` : null,
    `الخدمة: ${getServiceName(appointment)}`,
    `الطبيب الجديد: د. ${toDoctor.name}`,
    `بدلاً من: د. ${fromDoctor.name}`,
    `التاريخ: ${formatDateAr(appointment.scheduledTime)}`,
    appointment.appointmentType === 'SCHEDULED' ? `الوقت: ${formatTimeAr(appointment.scheduledTime)}` : null,
    '',
    'وقت الموعد والخدمة كما هما بدون تغيير.',
  ]
    .filter(Boolean)
    .join('\n');

const sendDoctorRescheduled = async (appointment, fromDoctor, toDoctor) => {
  const channel = resolveChannel(appointment.patient);
  if (!channel) return;

  const content = buildDoctorRescheduledText(appointment, fromDoctor, toDoctor);

  if (channel === 'WHATSAPP') {
    await sendWhatsAppTextOrTemplate({
      patient: appointment.patient,
      textContent: content,
      templateName: WHATSAPP_TEMPLATES.doctorRescheduled,
      bodyParams: [
        appointment.patient?.name || 'عزيزنا المريض',
        appointment.bookingRef || '-',
        getServiceName(appointment),
        toDoctor.name,
        fromDoctor.name,
        formatDateAr(appointment.scheduledTime),
        appointment.appointmentType === 'WALK_IN'
          ? 'الدخول حسب أسبقية الحضور'
          : formatTimeAr(appointment.scheduledTime),
      ],
    });
  } else {
    await sendTextByChannel({ channel, patient: appointment.patient, content });
  }

  await logOutboundMessageIfNeeded({
    appointment,
    channel,
    content,
    metadata: {
      source: 'DOCTOR_RESCHEDULE',
      appointmentId: appointment.id,
      fromDoctorId: fromDoctor.id,
      toDoctorId: toDoctor.id,
    },
  });

  await createNotificationRecord(appointment.id, 'doctor_rescheduled', channel);
};

module.exports = {
  sendReminders,
  sendWalkInRemindersBeforeOpening,
  sendBookingConfirmed,
  sendBookingRejected,
  sendBookingCancelled,
  sendDoctorRescheduled,
};
