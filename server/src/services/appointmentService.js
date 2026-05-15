const prisma = require('../lib/prisma');
const { generateTimeSlots, formatDateAr, formatTimeAr } = require('../utils/helpers');

const BLOCKING_STATUSES = ['CONFIRMED', 'PENDING', 'BLOCKED'];
const PENDING_APPOINTMENT_EXPIRY_HOURS = Number(process.env.PENDING_APPOINTMENT_EXPIRY_HOURS || 24);
const WALK_IN_DAILY_LIMIT = Number(process.env.WALK_IN_DAILY_LIMIT || 30);

const buildRange = (time, durationMinutes) => {
  const start = new Date(time).getTime();
  const end = start + durationMinutes * 60 * 1000;
  return { start, end };
};

const rangesOverlap = (a, b) => a.start < b.end && a.end > b.start;

const hasWorkingHours = (workingHours) =>
  Boolean(workingHours && typeof workingHours === 'object' && Object.values(workingHours).some(Boolean));

const getClinicWorkingHours = async () => {
  const settings = await prisma.clinicSettings.findFirst({
    select: { workingHours: true },
  });
  return settings?.workingHours || {};
};

const resolveWorkingHours = async (doctorWorkingHours) => {
  if (hasWorkingHours(doctorWorkingHours)) return doctorWorkingHours;
  return getClinicWorkingHours();
};

const getDayBounds = (time) => {
  const dayStart = new Date(time);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(time);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
};

const buildWalkInScheduledTime = (dateValue) => {
  const date = new Date(dateValue);
  date.setHours(12, 0, 0, 0);
  return date;
};

const getDoctorWalkInCount = async ({ doctorId, dateValue, excludeAppointmentId = null }) => {
  const { dayStart, dayEnd } = getDayBounds(dateValue);
  return prisma.appointment.count({
    where: {
      doctorId,
      appointmentType: 'WALK_IN',
      status: { in: BLOCKING_STATUSES },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      scheduledTime: { gte: dayStart, lte: dayEnd },
    },
  });
};

const getAppointmentConflict = async ({ doctorId, scheduledTime, duration, excludeAppointmentId = null }) => {
  const { dayStart, dayEnd } = getDayBounds(scheduledTime);
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentType: 'SCHEDULED',
      status: { in: BLOCKING_STATUSES },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      scheduledTime: { gte: dayStart, lte: dayEnd },
    },
    include: { service: true },
  });

  const requestedRange = buildRange(scheduledTime, duration);
  return existingAppointments.find((appointment) => {
    const appointmentDuration = appointment.service?.duration || duration;
    const appointmentRange = buildRange(appointment.scheduledTime, appointmentDuration);
    return rangesOverlap(requestedRange, appointmentRange);
  });
};

const isDoctorAvailableAt = async ({
  doctorId,
  scheduledTime,
  duration,
  excludeAppointmentId = null,
  ignoreLeadTime = false,
}) => {
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, active: true } });
  if (!doctor) return false;

  const requested = new Date(scheduledTime);
  const minLeadMinutes = Number(process.env.MIN_BOOKING_LEAD_MINUTES || 10);
  if (!ignoreLeadTime && requested < new Date(Date.now() + minLeadMinutes * 60 * 1000)) return false;

  const workingHours = await resolveWorkingHours(doctor.workingHours);
  const daySlots = generateTimeSlots(requested, workingHours, duration, []);
  const inWorkingHours = daySlots.some((slot) => new Date(slot.time).getTime() === requested.getTime());
  if (!inWorkingHours) return false;

  const conflict = await getAppointmentConflict({
    doctorId,
    scheduledTime: requested,
    duration,
    excludeAppointmentId,
  });
  return !conflict;
};

const getAvailableDoctorsAt = async ({ serviceId, scheduledTime, doctorIds = null }) => {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error('الخدمة غير موجودة');

  const doctors = await prisma.doctor.findMany({
    where: {
      active: true,
      ...(Array.isArray(doctorIds) && doctorIds.length > 0 ? { id: { in: doctorIds } } : {}),
      OR: [{ tasks: { none: {} } }, { tasks: { some: { serviceId } } }],
    },
    orderBy: { createdAt: 'asc' },
  });

  const available = [];
  for (const doctor of doctors) {
    const ok = await isDoctorAvailableAt({
      doctorId: doctor.id,
      scheduledTime,
      duration: service.duration,
    });
    if (ok) {
      available.push({
        id: doctor.id,
        name: doctor.name,
        specialization: doctor.specialization,
        image: doctor.image,
      });
    }
  }

  return { service, doctors: available };
};

const generateBookingRef = async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const bookingRef = `B-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const exists = await prisma.appointment.findUnique({ where: { bookingRef } });
    if (!exists) {
      return bookingRef;
    }
  }

  return `B-${Date.now().toString(36).toUpperCase()}`;
};

const createAppointment = async ({
  patientId,
  doctorId,
  serviceId,
  scheduledTime,
  appointmentType = 'SCHEDULED',
  rescheduleAptId = null,
}) => {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error('الخدمة غير موجودة');

  const resolvedAppointmentType = appointmentType === 'WALK_IN' ? 'WALK_IN' : 'SCHEDULED';
  const resolvedScheduledTime =
    resolvedAppointmentType === 'WALK_IN'
      ? buildWalkInScheduledTime(scheduledTime)
      : new Date(scheduledTime);

  if (resolvedAppointmentType === 'WALK_IN') {
    const walkInCount = await getDoctorWalkInCount({
      doctorId,
      dateValue: resolvedScheduledTime,
      excludeAppointmentId: rescheduleAptId,
    });

    if (walkInCount >= WALK_IN_DAILY_LIMIT) {
      throw new Error(`تم الوصول إلى الحد اليومي للحجوزات لهذا الطبيب (${WALK_IN_DAILY_LIMIT})`);
    }
  } else {
    const doctorAvailable = await isDoctorAvailableAt({
      doctorId,
      scheduledTime: resolvedScheduledTime,
      duration: service.duration,
      excludeAppointmentId: rescheduleAptId,
    });

    if (!doctorAvailable) {
      const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
      const alternatives = await getAlternativeSlots(
        doctorId,
        resolvedScheduledTime,
        doctor?.workingHours || {},
        service.duration
      );
      return { conflict: true, alternatives };
    }

    const hasOverlap = await getAppointmentConflict({
      doctorId,
      scheduledTime: resolvedScheduledTime,
      duration: service.duration,
      excludeAppointmentId: rescheduleAptId,
    });

    if (hasOverlap) {
      const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
      const alternatives = await getAlternativeSlots(
        doctorId,
        resolvedScheduledTime,
        doctor?.workingHours || {},
        service.duration
      );
      return { conflict: true, alternatives };
    }
  }

  const lockedUntil = new Date(Date.now() + PENDING_APPOINTMENT_EXPIRY_HOURS * 60 * 60 * 1000);

  let appointment;

  if (rescheduleAptId) {
    const oldApt = await prisma.appointment.findUnique({ where: { id: rescheduleAptId } });
    const oldTimeFormatted = oldApt
      ? `${formatDateAr(oldApt.scheduledTime)} الساعة ${formatTimeAr(oldApt.scheduledTime)}`
      : 'وقت سابق';

    appointment = await prisma.appointment.update({
      where: { id: rescheduleAptId },
      data: {
        doctorId,
        serviceId,
        appointmentType: resolvedAppointmentType,
        scheduledTime: resolvedScheduledTime,
        status: 'PENDING',
        lockedUntil,
        notes: `تم التأجيل من: ${oldTimeFormatted}`,
      },
      include: {
        patient: true,
        doctor: true,
        service: true,
      },
    });
  } else {
    const bookingRef = await generateBookingRef();

    appointment = await prisma.appointment.create({
      data: {
        bookingRef,
        patientId,
        doctorId,
        serviceId,
        appointmentType: resolvedAppointmentType,
        scheduledTime: resolvedScheduledTime,
        status: 'PENDING',
        lockedUntil,
      },
      include: {
        patient: true,
        doctor: true,
        service: true,
      },
    });
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: { profileType: 'BOOKED' },
  });

  return { conflict: false, appointment };
};

const confirmAppointment = async (appointmentId) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { service: true, doctor: true, patient: true },
  });

  if (!appointment) throw new Error('الموعد غير موجود');
  if (appointment.status === 'CONFIRMED') throw new Error('الموعد مؤكد بالفعل');
  if (appointment.status === 'EXPIRED') throw new Error('الموعد منتهي الصلاحية');

  if (appointment.appointmentType === 'SCHEDULED') {
    const hasOverlap = await getAppointmentConflict({
      doctorId: appointment.doctorId,
      scheduledTime: appointment.scheduledTime,
      duration: appointment.service.duration,
      excludeAppointmentId: appointmentId,
    });

    if (hasOverlap) {
      const alternatives = await getAlternativeSlots(
        appointment.doctorId,
        appointment.scheduledTime,
        appointment.doctor.workingHours,
        appointment.service.duration
      );
      return { conflict: true, alternatives, appointment };
    }
  } else {
    const walkInCount = await getDoctorWalkInCount({
      doctorId: appointment.doctorId,
      dateValue: appointment.scheduledTime,
      excludeAppointmentId: appointmentId,
    });

    if (walkInCount >= WALK_IN_DAILY_LIMIT) {
      throw new Error(`تم الوصول إلى الحد اليومي للحجوزات لهذا الطبيب (${WALK_IN_DAILY_LIMIT})`);
    }
  }

  const confirmed = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CONFIRMED', lockedUntil: null },
    include: { patient: true, doctor: true, service: true },
  });

  return { conflict: false, appointment: confirmed };
};

const rejectAppointment = async (appointmentId, reason) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { doctor: true, service: true, patient: true },
  });

  if (!appointment) throw new Error('الموعد غير موجود');

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'REJECTED', notes: reason || 'تم الرفض من قبل الطبيب' },
    include: { patient: true, doctor: true, service: true },
  });

  const alternatives =
    appointment.appointmentType === 'SCHEDULED'
      ? await getAlternativeSlots(
          appointment.doctorId,
          appointment.scheduledTime,
          appointment.doctor.workingHours,
          appointment.service.duration
        )
      : [];

  return { appointment: updated, alternatives };
};

const getAlternativeSlots = async (doctorId, aroundTime, workingHours, duration = 30) => {
  const baseDate = new Date(aroundTime);
  const resolvedWorkingHours = await resolveWorkingHours(workingHours);
  const slots = [];

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + dayOffset);

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentType: 'SCHEDULED',
        status: { in: BLOCKING_STATUSES },
        scheduledTime: { gte: dayStart, lte: dayEnd },
      },
      include: { service: true },
    });

    const bookedTimes = bookedAppointments.map((appointment) => ({
      start: appointment.scheduledTime,
      duration: appointment.service?.duration || duration,
    }));
    const daySlots = generateTimeSlots(date, resolvedWorkingHours, duration, bookedTimes);
    slots.push(...daySlots);

    if (slots.length >= 10) break;
  }

  return slots.slice(0, 10);
};

const expirePendingAppointments = async () => {
  const expired = await prisma.appointment.updateMany({
    where: {
      status: 'PENDING',
      lockedUntil: { lte: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  if (expired.count > 0) {
    console.log(`[Expiry] Expired ${expired.count} pending appointment(s)`);
  }

  return expired;
};

module.exports = {
  createAppointment,
  confirmAppointment,
  rejectAppointment,
  getAlternativeSlots,
  getAppointmentConflict,
  getAvailableDoctorsAt,
  isDoctorAvailableAt,
  expirePendingAppointments,
};
