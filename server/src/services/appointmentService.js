const prisma = require('../lib/prisma');
const { generateTimeSlots, formatDateAr, formatTimeAr } = require('../utils/helpers');

const BLOCKING_STATUSES = ['CONFIRMED', 'PENDING', 'BLOCKED'];

const buildRange = (time, durationMinutes) => {
  const start = new Date(time).getTime();
  const end = start + durationMinutes * 60 * 1000;
  return { start, end };
};

const rangesOverlap = (a, b) => a.start < b.end && a.end > b.start;

const getDayBounds = (time) => {
  const dayStart = new Date(time);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(time);
  dayEnd.setHours(23, 59, 59, 999);
  return { dayStart, dayEnd };
};

const getAppointmentConflict = async ({ doctorId, scheduledTime, duration, excludeAppointmentId = null }) => {
  const { dayStart, dayEnd } = getDayBounds(scheduledTime);
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
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

/**
 * Create a new appointment with conflict detection + pending lock
 */
const createAppointment = async ({ patientId, doctorId, serviceId, scheduledTime, rescheduleAptId = null }) => {
  // Get the service for duration
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error('الخدمة غير موجودة');

  const hasOverlap = await getAppointmentConflict({
    doctorId,
    scheduledTime,
    duration: service.duration,
    excludeAppointmentId: rescheduleAptId,
  });

  if (hasOverlap) {
    // There's a conflict - suggest alternatives
    const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
    const alternatives = await getAlternativeSlots(doctorId, scheduledTime, doctor.workingHours, service.duration);
    return { conflict: true, alternatives };
  }

  const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);

  let appointment;

  if (rescheduleAptId) {
    // We are rescheduling an existing appointment
    const oldApt = await prisma.appointment.findUnique({ where: { id: rescheduleAptId } });
    const oldTimeFormatted = oldApt ? `${formatDateAr(oldApt.scheduledTime)} الساعة ${formatTimeAr(oldApt.scheduledTime)}` : 'وقت سابق';

    appointment = await prisma.appointment.update({
      where: { id: rescheduleAptId },
      data: {
        doctorId,
        serviceId,
        scheduledTime: new Date(scheduledTime),
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
    // Generate a friendly uppercase 6-char booking ID (e.g. B-XY3K9P)
    const bookingRef = await generateBookingRef();

    appointment = await prisma.appointment.create({
      data: {
        bookingRef,
        patientId,
        doctorId,
        serviceId,
        scheduledTime: new Date(scheduledTime),
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

  return { conflict: false, appointment };
};

/**
 * Confirm an appointment (with final conflict check)
 */
const confirmAppointment = async (appointmentId) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { service: true, doctor: true, patient: true },
  });

  if (!appointment) throw new Error('الموعد غير موجود');
  if (appointment.status === 'CONFIRMED') throw new Error('الموعد مؤكد بالفعل');
  if (appointment.status === 'EXPIRED') throw new Error('الموعد منتهي الصلاحية');

  // Final conflict check
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

  const confirmed = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CONFIRMED', lockedUntil: null },
    include: { patient: true, doctor: true, service: true },
  });

  return { conflict: false, appointment: confirmed };
};

/**
 * Reject an appointment and suggest alternatives
 */
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

  const alternatives = await getAlternativeSlots(
    appointment.doctorId,
    appointment.scheduledTime,
    appointment.doctor.workingHours,
    appointment.service.duration
  );

  return { appointment: updated, alternatives };
};

/**
 * Get alternative available slots near the requested time
 */
const getAlternativeSlots = async (doctorId, aroundTime, workingHours, duration = 30) => {
  const baseDate = new Date(aroundTime);
  const slots = [];

  // Check the next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + dayOffset);

    // Get booked slots for this day
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        status: { in: BLOCKING_STATUSES },
        scheduledTime: { gte: dayStart, lte: dayEnd },
      },
      include: { service: true },
    });

    const bookedTimes = bookedAppointments.map((appointment) => ({
      start: appointment.scheduledTime,
      duration: appointment.service?.duration || duration,
    }));
    const daySlots = generateTimeSlots(date, workingHours, duration, bookedTimes);
    slots.push(...daySlots);

    if (slots.length >= 10) break;
  }

  return slots.slice(0, 10);
};

/**
 * Expire stale pending appointments
 */
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
  expirePendingAppointments,
};
