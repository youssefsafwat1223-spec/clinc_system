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

const getServiceName = (appointment) => appointment.service?.nameAr || appointment.service?.name || 'ط§ظ„ط®ط¯ظ…ط©';
const getDoctorName = (appointment) => appointment.doctor?.name || 'ط؛ظٹط± ظ…ط­ط¯ط¯';

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

const buildGeneralOpeningReminderText = (appointment, openingTime, title = 'طھط°ظƒظٹط± ط¨ظ…ظˆط¹ط¯ظƒ') =>
  [
    title,
    '',
    `ظ…ط±ط­ط¨ط§ظ‹ ${appointment.patient?.displayName || appointment.patient?.name || 'ط¹ط²ظٹط²ظ†ط§ ط§ظ„ظ…ط±ظٹط¶'}طŒ`,
    `ظ…ظˆط¹ط¯ظƒ ظٹظˆظ… ${formatDayNameAr(appointment.scheduledTime)} ط§ظ„ظ…ظˆط§ظپظ‚ ${formatDateAr(appointment.scheduledTime)}.`,
    `طھظپطھط­ ط§ظ„ط¹ظٹط§ط¯ط© ط§ظ„ط³ط§ط¹ط© ${formatReminderOpeningTime(openingTime)}طŒ ظˆط§ظ„ط§ط³طھظ‚ط¨ط§ظ„ ط¨ط§ظ„طھط±طھظٹط¨ ط­ط³ط¨ ط§ظ„ط­ط¶ظˆط±.`,
    'ظٹط±ط¬ظ‰ ط§ظ„ط¹ظ„ظ… ط£ظ† ظ‡ط°ط§ ظˆظ‚طھ ظپطھط­ ط§ظ„ط¹ظٹط§ط¯ط© ظˆظ„ظٹط³ ظ…ظˆط¹ط¯ظ‹ط§ ظ…ط­ط¯ط¯ظ‹ط§ ط®ط§طµظ‹ط§ ط¨ظƒ.',
    '',
    `ط§ظ„ط·ط¨ظٹط¨: ${getDoctorName(appointment)}`,
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    '',
    'ظ„ط£ظٹ ط§ط³طھظپط³ط§ط± ط£ظˆ طھط¹ط¯ظٹظ„ طھظˆط§طµظ„ ظ…ط¹ظ†ط§.',
  ].join('\n');

const sendAppointmentReminderTemplate = async ({ appointment, patient, reminderText, openingTime }) => {
  const canUseV3 = process.env.APPOINTMENT_REMINDER_V3_ENABLED === 'true';
  const v3Params = [
    patient?.displayName || patient?.name || 'ط¹ط²ظٹط²ظ†ط§ ط§ظ„ظ…ط±ظٹط¶',
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
    'طھط°ظƒظٹط± ط¨ظ…ظˆط¹ط¯ظƒ',
    '',
    `ظ…ط±ط­ط¨ط§ظ‹ ${appointment.patient?.name || 'ط¹ط²ظٹط²ظ†ط§ ط§ظ„ظ…ط±ظٹط¶'}طŒ`,
    `ظ†ط°ظƒط±ظƒ ط¨ظ…ظˆط¹ط¯ظƒ ظٹظˆظ… ${formatDateAr(appointment.scheduledTime)} ط§ظ„ط³ط§ط¹ط© ${formatTimeAr(appointment.scheduledTime)}.`,
    '',
    `ط§ظ„ط·ط¨ظٹط¨: ${getDoctorName(appointment)}`,
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    '',
    'ظ†طھط·ظ„ط¹ ظ„ط±ط¤ظٹطھظƒ.',
  ].join('\n');

const buildWalkInReminderText = (appointment, openingTime) =>
  [
    'طھط°ظƒظٹط± ط¨ط­ط¬ط²ظƒ ط§ظ„ظٹظˆظ…',
    '',
    `ظ…ط±ط­ط¨ط§ظ‹ ${appointment.patient?.name || 'ط¹ط²ظٹط²ظ†ط§ ط§ظ„ظ…ط±ظٹط¶'}طŒ`,
    `ظ†ط°ظƒط±ظƒ ط¨ط­ط¬ط²ظƒ ط§ظ„ظٹظˆظ… ${formatDateAr(appointment.scheduledTime)}.`,
    `ظٹط¨ط¯ط£ ط§ط³طھظ‚ط¨ط§ظ„ ط§ظ„ظ…ط±ط§ط¬ط¹ظٹظ† ظ…ظ† ط§ظ„ط³ط§ط¹ط© ${formatTimeAr(openingTime)}.`,
    '',
    `ط§ظ„ط·ط¨ظٹط¨: ${getDoctorName(appointment)}`,
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    '',
    'ظ…ظ„ط§ط­ط¸ط©: ط§ظ„ط¯ط®ظˆظ„ ط­ط³ط¨ ط£ط³ط¨ظ‚ظٹط© ط§ظ„ط­ط¶ظˆط±طŒ ظˆط§ظ„ط´ط®طµ ط§ظ„ط°ظٹ ظٹطµظ„ ط£ظˆظ„ط§ظ‹ ظٹط¯ط®ظ„ ط£ظˆظ„ط§ظ‹.',
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
            appointment.patient?.name || 'ط¹ط²ظٹط²ظ†ط§ ط§ظ„ظ…ط±ظٹط¶',
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
  const lines = ['طھظ… طھط£ظƒظٹط¯ ط­ط¬ط²ظƒ ط¨ظ†ط¬ط§ط­.', ''];

  if (appointment.bookingRef) {
    lines.push(`ط±ظ‚ظ… ط§ظ„ط­ط¬ط²: *${appointment.bookingRef}*`, '');
  }

  lines.push(
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    `ط§ظ„ط·ط¨ظٹط¨: ${getDoctorName(appointment)}`,
    `ط§ظ„طھط§ط±ظٹط®: ${formatDateAr(appointment.scheduledTime)}`,
    `ط§ظ„ظˆظ‚طھ: ${formatTimeAr(appointment.scheduledTime)}`,
    '',
    'ط³ظ†ط±ط³ظ„ ظ„ظƒ طھط°ظƒظٹط±ط§ظ‹ ظ‚ط¨ظ„ ط§ظ„ظ…ظˆط¹ط¯. ط´ظƒط±ط§ظ‹ ظ„ظƒ.'
  );

  return lines.join('\n');
};

const buildWalkInConfirmationText = (appointment) =>
  [
    'طھظ… طھط£ظƒظٹط¯ ط­ط¬ط²ظƒ ط¨ظ†ط¬ط§ط­.',
    '',
    appointment.bookingRef ? `ط±ظ‚ظ… ط§ظ„ط­ط¬ط²: *${appointment.bookingRef}*` : null,
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    `ط§ظ„ط·ط¨ظٹط¨: ${getDoctorName(appointment)}`,
    `ط§ظ„طھط§ط±ظٹط®: ${formatDateAr(appointment.scheduledTime)}`,
    '',
    'ظ…ظ„ط§ط­ط¸ط©: ط§ظ„ط¯ط®ظˆظ„ ط­ط³ط¨ ط£ط³ط¨ظ‚ظٹط© ط§ظ„ط­ط¶ظˆط±طŒ ظˆط§ظ„ط´ط®طµ ط§ظ„ط°ظٹ ظٹطµظ„ ط£ظˆظ„ط§ظ‹ ظٹط¯ط®ظ„ ط£ظˆظ„ط§ظ‹.',
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
          ? 'ط§ظ„ط¯ط®ظˆظ„ ط­ط³ط¨ ط£ط³ط¨ظ‚ظٹط© ط§ظ„ط­ط¶ظˆط±'
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
    'طھط¹ط°ط± طھط«ط¨ظٹطھ ط§ظ„ظ…ظˆط¹ط¯ ط§ظ„ظ…ط·ظ„ظˆط¨.',
    '',
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    `ط§ظ„ط³ط¨ط¨: ${appointment.notes || 'طھط¹ط¯ظٹظ„ ط¥ط¯ط§ط±ظٹ'}`,
  ];

  if (alternatives.length > 0) {
    baseLines.push('', 'ط§ظ„ظ…ظˆط§ط¹ظٹط¯ ط§ظ„ط¨ط¯ظٹظ„ط© ط§ظ„ظ…ظ‚طھط±ط­ط©:');
    alternatives.slice(0, 5).forEach((alternative) => {
      baseLines.push(`- ${alternative.label}`);
    });
  } else {
    baseLines.push('', 'ظٹط±ط¬ظ‰ ط§ظ„طھظˆط§طµظ„ ظ…ط¹ظ†ط§ ظ„طھط­ط¯ظٹط¯ ظ…ظˆط¹ط¯ ط¨ط¯ظٹظ„.');
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
            appointment.notes || 'طھط¹ط¯ظٹظ„ ط¥ط¯ط§ط±ظٹ',
            normalizedAlternatives[0],
            normalizedAlternatives[1],
            normalizedAlternatives[2],
          ]
        : [getServiceName(appointment), appointment.notes || 'طھط¹ط¯ظٹظ„ ط¥ط¯ط§ط±ظٹ'];

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
    'طھظ… ط¥ظ„ط؛ط§ط، ط­ط¬ط²ظƒ.',
    '',
    appointment.bookingRef ? `ط±ظ‚ظ… ط§ظ„ط­ط¬ط²: *${appointment.bookingRef}*` : null,
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    `ط§ظ„ط·ط¨ظٹط¨: ${getDoctorName(appointment)}`,
    `ط§ظ„طھط§ط±ظٹط®: ${formatDateAr(appointment.scheduledTime)}`,
    appointment.appointmentType === 'SCHEDULED' ? `ط§ظ„ظˆظ‚طھ: ${formatTimeAr(appointment.scheduledTime)}` : null,
    '',
    reason ? `ط§ظ„ط³ط¨ط¨: ${reason}` : 'طھظ… ط§ظ„ط¥ظ„ط؛ط§ط، ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط·ظ„ط¨ ط¥ط¯ط§ط±ظٹ.',
    '',
    'ظٹط³ط¹ط¯ظ†ط§ ط®ط¯ظ…طھظƒ ظپظٹ ط£ظٹ ظˆظ‚طھ ظ„ط­ط¬ط² ظ…ظˆط¹ط¯ ط¬ط¯ظٹط¯.',
  ]
    .filter(Boolean)
    .join('\n');

const sendBookingCancelled = async (appointment, reason) => {
  const channel = resolveChannel(appointment.patient);
  if (!channel) return;

  const content = buildBookingCancelledText(appointment, reason);
  const cancellationReason = reason || 'ط¥ظ„ط؛ط§ط، ط§ظ„ط­ط¬ط²';

  if (channel === 'WHATSAPP') {
    const appointmentSummary =
      appointment.appointmentType === 'WALK_IN'
        ? `${getServiceName(appointment)} ظ…ط¹ ط¯. ${getDoctorName(appointment)} ظٹظˆظ… ${formatDateAr(appointment.scheduledTime)}`
        : `${getServiceName(appointment)} ظ…ط¹ ط¯. ${getDoctorName(appointment)} ظٹظˆظ… ${formatDateAr(appointment.scheduledTime)} ط§ظ„ط³ط§ط¹ط© ${formatTimeAr(appointment.scheduledTime)}`;
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
    'طھظ… طھط­ط¯ظٹط« ط·ط¨ظٹط¨ ظ…ظˆط¹ط¯ظƒ.',
    '',
    appointment.bookingRef ? `ط±ظ‚ظ… ط§ظ„ط­ط¬ط²: *${appointment.bookingRef}*` : null,
    `ط§ظ„ط®ط¯ظ…ط©: ${getServiceName(appointment)}`,
    `ط§ظ„ط·ط¨ظٹط¨ ط§ظ„ط¬ط¯ظٹط¯: ط¯. ${toDoctor.name}`,
    `ط¨ط¯ظ„ط§ظ‹ ظ…ظ†: ط¯. ${fromDoctor.name}`,
    `ط§ظ„طھط§ط±ظٹط®: ${formatDateAr(appointment.scheduledTime)}`,
    appointment.appointmentType === 'SCHEDULED' ? `ط§ظ„ظˆظ‚طھ: ${formatTimeAr(appointment.scheduledTime)}` : null,
    '',
    'ظˆظ‚طھ ط§ظ„ظ…ظˆط¹ط¯ ظˆط§ظ„ط®ط¯ظ…ط© ظƒظ…ط§ ظ‡ظ…ط§ ط¨ط¯ظˆظ† طھط؛ظٹظٹط±.',
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
        appointment.patient?.name || 'ط¹ط²ظٹط²ظ†ط§ ط§ظ„ظ…ط±ظٹط¶',
        appointment.bookingRef || '-',
        getServiceName(appointment),
        toDoctor.name,
        fromDoctor.name,
        formatDateAr(appointment.scheduledTime),
        appointment.appointmentType === 'WALK_IN'
          ? 'ط§ظ„ط¯ط®ظˆظ„ ط­ط³ط¨ ط£ط³ط¨ظ‚ظٹط© ط§ظ„ط­ط¶ظˆط±'
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
