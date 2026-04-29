const prisma = require('../lib/prisma');
const appointmentService = require('../services/appointmentService');
const notificationService = require('../services/notificationService');
const { paginate } = require('../utils/helpers');

const getScopedDoctor = async (req) => {
  if (req.user?.role !== 'DOCTOR') {
    return null;
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: req.user.id },
    select: { id: true, name: true },
  });

  if (!doctor) {
    const error = new Error('لا يوجد ملف طبيب مرتبط بهذا الحساب');
    error.status = 403;
    throw error;
  }

  return doctor;
};

const getAccessibleAppointment = async (req, appointmentId, include = {}) => {
  const scopedDoctor = await getScopedDoctor(req);

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      ...(scopedDoctor ? { doctorId: scopedDoctor.id } : {}),
    },
    include,
  });

  return { appointment, scopedDoctor };
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, doctorId, date } = req.query;
    const { skip, take } = paginate(Number(page), Number(limit));
    const scopedDoctor = await getScopedDoctor(req);

    const where = {};
    if (status === 'RESCHEDULED') {
      where.notes = { contains: 'تعديل' };
    } else if (status) {
      where.status = status;
    }

    if (scopedDoctor) {
      where.doctorId = scopedDoctor.id;
    } else if (doctorId) {
      where.doctorId = doctorId;
    }

    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      where.scheduledTime = { gte: dayStart, lte: dayEnd };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take,
        orderBy: { scheduledTime: 'desc' },
        include: {
          patient: true,
          doctor: true,
          service: true,
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      appointments,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const { appointment } = await getAccessibleAppointment(req, req.params.id, {
      patient: true,
      doctor: true,
      service: true,
      notifications: { orderBy: { createdAt: 'desc' } },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'الموعد غير موجود' });
    }

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const scopedDoctor = await getScopedDoctor(req);
    const {
      patientId,
      doctorId,
      serviceId,
      scheduledTime,
      confirmImmediately = false,
      notifyPatient = true,
      notes,
    } = req.body;

    let result = await appointmentService.createAppointment({
      patientId,
      doctorId: scopedDoctor?.id || doctorId,
      serviceId,
      scheduledTime,
    });

    if (result.conflict) {
      return res.status(409).json({
        error: 'هذا الموعد غير متاح',
        alternatives: result.alternatives,
      });
    }

    let appointment = result.appointment;

    if (notes !== undefined) {
      appointment = await prisma.appointment.update({
        where: { id: appointment.id },
        data: { notes },
        include: { patient: true, doctor: true, service: true },
      });
    }

    if (confirmImmediately) {
      result = await appointmentService.confirmAppointment(appointment.id);

      if (result.conflict) {
        return res.status(409).json({
          error: 'تعذر تأكيد الموعد بسبب تعارض جديد',
          alternatives: result.alternatives,
          appointment: appointment,
        });
      }

      appointment = result.appointment;

      if (notifyPatient) {
        try {
          await notificationService.sendBookingConfirmed(appointment);
        } catch (e) {
          console.error('Notification error:', e.message);
        }
      }
    }

    res.status(201).json({ appointment });
  } catch (error) {
    next(error);
  }
};

const availability = async (req, res, next) => {
  try {
    const { serviceId, scheduledTime } = req.query;
    if (!serviceId || !scheduledTime) {
      return res.status(400).json({ error: 'الخدمة والوقت مطلوبان' });
    }

    const result = await appointmentService.getAvailableDoctorsAt({
      serviceId,
      scheduledTime,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const previewRescheduleByDoctor = async (req, res, next) => {
  try {
    const { fromDoctorId, toDoctorId } = req.body;

    if (!fromDoctorId || !toDoctorId || fromDoctorId === toDoctorId) {
      return res.status(400).json({ error: 'اختر الطبيب القديم والطبيب البديل بشكل صحيح' });
    }

    const [fromDoctor, toDoctor] = await Promise.all([
      prisma.doctor.findUnique({ where: { id: fromDoctorId } }),
      prisma.doctor.findFirst({ where: { id: toDoctorId, active: true } }),
    ]);

    if (!fromDoctor || !toDoctor) {
      return res.status(404).json({ error: 'الطبيب غير موجود أو غير مفعل' });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: fromDoctorId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledTime: { gte: new Date() },
      },
      include: { patient: true, service: true },
      orderBy: { scheduledTime: 'asc' },
    });

    const unavailableAppointmentIds = [];
    const checkedAppointments = [];
    for (const appointment of appointments) {
      const available = await appointmentService.isDoctorAvailableAt({
        doctorId: toDoctorId,
        scheduledTime: appointment.scheduledTime,
        duration: appointment.service?.duration || 30,
      });
      if (!available) unavailableAppointmentIds.push(appointment.id);
      checkedAppointments.push({ ...appointment, targetDoctorAvailable: available });
    }

    res.json({
      fromDoctor,
      toDoctor,
      appointments: checkedAppointments,
      affectedAppointments: checkedAppointments.length,
      unavailableAppointmentIds,
      canProceed: unavailableAppointmentIds.length === 0,
    });
  } catch (error) {
    next(error);
  }
};

const rescheduleByDoctor = async (req, res, next) => {
  try {
    const { fromDoctorId, toDoctorId, notifyPatient = true } = req.body;

    if (!fromDoctorId || !toDoctorId || fromDoctorId === toDoctorId) {
      return res.status(400).json({ error: 'اختر الطبيب القديم والطبيب البديل بشكل صحيح' });
    }

    const [fromDoctor, toDoctor] = await Promise.all([
      prisma.doctor.findUnique({ where: { id: fromDoctorId } }),
      prisma.doctor.findFirst({ where: { id: toDoctorId, active: true } }),
    ]);

    if (!fromDoctor || !toDoctor) {
      return res.status(404).json({ error: 'الطبيب غير موجود أو غير مفعل' });
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: fromDoctorId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledTime: { gte: new Date() },
      },
      include: { patient: true, service: true },
      orderBy: { scheduledTime: 'asc' },
    });

    const unavailableAppointmentIds = [];
    for (const appointment of appointments) {
      const available = await appointmentService.isDoctorAvailableAt({
        doctorId: toDoctorId,
        scheduledTime: appointment.scheduledTime,
        duration: appointment.service?.duration || 30,
      });
      if (!available) unavailableAppointmentIds.push(appointment.id);
    }

    if (unavailableAppointmentIds.length) {
      return res.status(409).json({
        error: 'الطبيب البديل غير متاح في بعض المواعيد',
        unavailableAppointmentIds,
      });
    }

    await prisma.appointment.updateMany({
      where: { id: { in: appointments.map((appointment) => appointment.id) } },
      data: {
        doctorId: toDoctorId,
        notes: `تم نقل الموعد من ${fromDoctor.name} إلى ${toDoctor.name}`,
      },
    });

    if (notifyPatient) {
      for (const appointment of appointments) {
        try {
          await notificationService.sendDoctorRescheduled(appointment, fromDoctor, toDoctor);
        } catch (error) {
          console.error('[Doctor reschedule] notify failed:', error.message);
        }
      }
    }

    res.json({ success: true, affectedAppointments: appointments.length });
  } catch (error) {
    next(error);
  }
};

const confirm = async (req, res, next) => {
  try {
    const { appointment } = await getAccessibleAppointment(req, req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'الموعد غير موجود' });
    }

    const result = await appointmentService.confirmAppointment(req.params.id);

    if (result.conflict) {
      return res.status(409).json({
        error: 'تضارب في المواعيد',
        alternatives: result.alternatives,
      });
    }

    try {
      await notificationService.sendBookingConfirmed(result.appointment);
    } catch (e) {
      console.error('Notification error:', e.message);
    }

    res.json({ appointment: result.appointment });
  } catch (error) {
    next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const { appointment } = await getAccessibleAppointment(req, req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'الموعد غير موجود' });
    }

    const { reason } = req.body;
    const result = await appointmentService.rejectAppointment(req.params.id, reason);

    try {
      await notificationService.sendBookingRejected(result.appointment, result.alternatives);
    } catch (e) {
      console.error('Notification error:', e.message);
    }

    res.json({
      appointment: result.appointment,
      alternatives: result.alternatives,
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { appointment: existingAppointment } = await getAccessibleAppointment(req, req.params.id);
    if (!existingAppointment) {
      return res.status(404).json({ error: 'الموعد غير موجود' });
    }

    const { scheduledTime, notes, status } = req.body;
    if (scheduledTime) {
      const existingWithService = await prisma.appointment.findUnique({
        where: { id: req.params.id },
        include: { service: true, doctor: true },
      });
      const conflict = await appointmentService.getAppointmentConflict({
        doctorId: existingWithService.doctorId,
        scheduledTime: new Date(scheduledTime),
        duration: existingWithService.service?.duration || 30,
        excludeAppointmentId: req.params.id,
      });

      if (conflict) {
        const alternatives = await appointmentService.getAlternativeSlots(
          existingWithService.doctorId,
          scheduledTime,
          existingWithService.doctor.workingHours,
          existingWithService.service?.duration || 30
        );
        return res.status(409).json({
          error: 'هذا الموعد غير متاح',
          alternatives,
        });
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        ...(scheduledTime && { scheduledTime: new Date(scheduledTime) }),
        ...(notes !== undefined && { notes }),
        ...(status && { status }),
      },
      include: { patient: true, doctor: true, service: true },
    });

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const complete = async (req, res, next) => {
  try {
    const { appointment: existingAppointment } = await getAccessibleAppointment(req, req.params.id);
    if (!existingAppointment) {
      return res.status(404).json({ error: 'الموعد غير موجود' });
    }

    if (existingAppointment.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'لا يمكن تحديد "تم الكشف" إلا للمواعيد المؤكدة' });
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
      include: { patient: true, doctor: true, service: true },
    });

    if (appointment.service?.price) {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: {
          totalSpent: { increment: Number(appointment.service.price) || 0 },
          lastPaymentDate: new Date(),
        },
      });
    }

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};


const cancel = async (req, res, next) => {
  try {
    const { appointment: existingAppointment } = await getAccessibleAppointment(req, req.params.id);
    if (!existingAppointment) {
      return res.status(404).json({ error: 'الموعد غير موجود' });
    }

    if (!['PENDING', 'CONFIRMED'].includes(existingAppointment.status)) {
      return res.status(400).json({ error: 'لا يمكن إلغاء هذا الموعد في حالته الحالية' });
    }

    const { reason } = req.body || {};
    const cancellationReason = (reason && String(reason).trim()) || 'إلغاء إداري للحجز';

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        status: 'CANCELLED',
        notes: cancellationReason,
      },
      include: { patient: true, doctor: true, service: true },
    });

    try {
      await notificationService.sendBookingCancelled(appointment, cancellationReason);
    } catch (e) {
      console.error('Notification error:', e.message);
    }

    res.json({ appointment });
  } catch (error) {
    next(error);
  }
};

const block = async (req, res, next) => {
  try {
    const appointmentId = req.params.id;
    const { appointment: existingAppointment } = await getAccessibleAppointment(req, appointmentId);
    if (!existingAppointment) {
      return res.status(404).json({ error: 'الموعد غير موجود' });
    }

    const appointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'BLOCKED', notes: 'تم إغلاق الموعد من قبل الإدارة' },
      include: { patient: true, doctor: true, service: true },
    });

    const alternatives = await appointmentService.getAlternativeSlots(
      appointment.doctorId,
      appointment.scheduledTime,
      appointment.doctor.workingHours,
      appointment.service.duration
    );

    try {
      await notificationService.sendBookingRejected(appointment, alternatives);
    } catch (e) {
      console.error('Notification error:', e.message);
    }

    res.json({ appointment, alternatives });
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const scopedDoctor = await getScopedDoctor(req);
    const statuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED', 'EXPIRED', 'BLOCKED', 'COMPLETED'];
    const counts = { ALL: 0, RESCHEDULED: 0 };
    const where = scopedDoctor ? { doctorId: scopedDoctor.id } : {};

    statuses.forEach((status) => {
      counts[status] = 0;
    });

    const [total, grouped, rescheduled] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      prisma.appointment.count({
        where: { ...where, notes: { contains: 'تعديل' } },
      }),
    ]);

    counts.ALL = total;
    counts.RESCHEDULED = rescheduled;

    grouped.forEach((group) => {
      counts[group.status] = group._count.status;
    });

    res.json(counts);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  confirm,
  reject,
  update,
  block,
  complete,
  cancel,
  getStats,
  availability,
  previewRescheduleByDoctor,
  rescheduleByDoctor,
};
