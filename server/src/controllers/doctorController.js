const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const getDoctorByUserId = async (userId, include = null) =>
  prisma.doctor.findUnique({
    where: { userId },
    ...(include ? { include } : {}),
  });

const getAll = async (req, res, next) => {
  try {
    const doctors = await prisma.doctor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, displayName: true, role: true, active: true } },
        _count: { select: { appointments: true } },
      },
    });

    res.json({ doctors });
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { email: true, displayName: true, role: true, active: true } },
        appointments: {
          include: { patient: true, service: true },
          orderBy: { scheduledTime: 'desc' },
          take: 20,
        },
      },
    });

    if (!doctor) {
      return res.status(404).json({ error: 'الطبيب غير موجود' });
    }

    res.json({ doctor });
  } catch (error) {
    next(error);
  }
};

const getMine = async (req, res, next) => {
  try {
    const doctor = await getDoctorByUserId(req.user.id, {
      user: { select: { email: true, displayName: true, role: true, active: true } },
      _count: { select: { appointments: true } },
    });

    if (!doctor) {
      return res.status(404).json({ error: 'لا يوجد ملف طبيب مرتبط بهذا الحساب' });
    }

    res.json({ doctor });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, displayName, specialization, phone, image, workingHours, email, password, active } = req.body;

    let userId = null;

    if (email && password) {
      const hashed = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email,
          password: hashed,
          name,
          displayName: displayName || name,
          role: 'DOCTOR',
          ...(active !== undefined && { active }),
        },
      });
      userId = user.id;
    }

    const doctor = await prisma.doctor.create({
      data: {
        name,
        specialization,
        phone,
        image,
        workingHours: workingHours || {},
        ...(active !== undefined && { active }),
        userId,
      },
      include: {
        user: { select: { email: true, displayName: true, role: true, active: true } },
      },
    });

    res.status(201).json({ doctor });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, displayName, specialization, phone, image, workingHours, active, email, password } = req.body;
    const existingDoctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!existingDoctor) {
      return res.status(404).json({ error: 'الطبيب غير موجود' });
    }

    const doctor = await prisma.$transaction(async (tx) => {
      let userId = existingDoctor.userId;

      if (existingDoctor.userId) {
        const userData = {
          ...(name !== undefined && { name }),
          ...(displayName !== undefined && { displayName: displayName || null }),
          ...(email !== undefined && email && { email }),
          ...(active !== undefined && { active }),
        };

        if (password) {
          userData.password = await bcrypt.hash(password, 12);
        }

        if (Object.keys(userData).length > 0) {
          await tx.user.update({
            where: { id: existingDoctor.userId },
            data: userData,
          });
        }
      } else if (email && password) {
        const hashed = await bcrypt.hash(password, 12);
        const user = await tx.user.create({
          data: {
            email,
            password: hashed,
            name: name || existingDoctor.name,
            displayName: displayName || name || existingDoctor.name,
            role: 'DOCTOR',
            ...(active !== undefined && { active }),
          },
        });

        userId = user.id;
      }

      return tx.doctor.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(specialization !== undefined && { specialization }),
          ...(phone !== undefined && { phone }),
          ...(image !== undefined && { image }),
          ...(workingHours !== undefined && { workingHours }),
          ...(active !== undefined && { active }),
          ...(userId !== existingDoctor.userId && { userId }),
        },
        include: {
          user: { select: { email: true, displayName: true, role: true, active: true } },
        },
      });
    });

    res.json({ doctor });
  } catch (error) {
    next(error);
  }
};

const updateMySchedule = async (req, res, next) => {
  try {
    const { workingHours } = req.body;

    if (workingHours === undefined || typeof workingHours !== 'object' || workingHours === null) {
      return res.status(400).json({ error: 'جدول العمل مطلوب' });
    }

    const existingDoctor = await getDoctorByUserId(req.user.id);
    if (!existingDoctor) {
      return res.status(404).json({ error: 'لا يوجد ملف طبيب مرتبط بهذا الحساب' });
    }

    const doctor = await prisma.doctor.update({
      where: { id: existingDoctor.id },
      data: { workingHours },
      include: {
        user: { select: { email: true, displayName: true, role: true, active: true } },
        _count: { select: { appointments: true } },
      },
    });

    res.json({ doctor });
  } catch (error) {
    next(error);
  }
};

const removeLegacy = async (req, res, next) => {
  try {
    const existingDoctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true },
    });

    if (!existingDoctor) {
      return res.status(404).json({ error: 'الطبيب غير موجود' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.doctor.delete({ where: { id: req.params.id } });

      if (existingDoctor.userId) {
        await tx.user.delete({ where: { id: existingDoctor.userId } });
      }
    });

    res.json({ message: 'تم حذف الطبيب بنجاح' });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const replacementDoctorId = req.body?.replacementDoctorId || req.query?.replacementDoctorId;
    const existingDoctor = await prisma.doctor.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, name: true },
    });

    if (!existingDoctor) {
      return res.status(404).json({ error: 'الطبيب غير موجود' });
    }

    const futureAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: req.params.id,
        status: { in: ['PENDING', 'CONFIRMED'] },
        scheduledTime: { gte: new Date() },
      },
      include: { patient: true, service: true },
    });

    if (futureAppointments.length > 0 && !replacementDoctorId) {
      return res.status(400).json({
        error: 'هذا الطبيب لديه مواعيد مستقبلية. اختر طبيبًا بديلًا لنقل المواعيد قبل التعطيل.',
        requiresReplacement: true,
        appointmentsCount: futureAppointments.length,
      });
    }

    let replacementDoctor = null;
    if (replacementDoctorId) {
      replacementDoctor = await prisma.doctor.findFirst({ where: { id: replacementDoctorId, active: true } });
      if (!replacementDoctor || replacementDoctor.id === existingDoctor.id) {
        return res.status(400).json({ error: 'الطبيب البديل غير صالح' });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (replacementDoctor) {
        await tx.appointment.updateMany({
          where: {
            doctorId: req.params.id,
            status: { in: ['PENDING', 'CONFIRMED'] },
            scheduledTime: { gte: new Date() },
          },
          data: {
            doctorId: replacementDoctor.id,
            notes: `تم نقل الموعد من ${existingDoctor.name} إلى ${replacementDoctor.name}`,
          },
        });
      }

      await tx.doctor.update({ where: { id: req.params.id }, data: { active: false } });

      if (existingDoctor.userId) {
        await tx.user.update({ where: { id: existingDoctor.userId }, data: { active: false } });
      }
    });

    if (replacementDoctor && futureAppointments.length > 0) {
      const whatsappService = require('../services/whatsappService');
      for (const appointment of futureAppointments) {
        try {
          await whatsappService.sendTextMessage(
            appointment.patient.phone,
            `تم تحديث طبيب موعدك القادم إلى ${replacementDoctor.name}. موعدك وخدمتك كما هي بدون تغيير.`
          );
        } catch (error) {
          console.error('[Doctor replacement] notify failed:', error.message);
        }
      }
    }

    res.json({
      message: replacementDoctor
        ? 'تم تعطيل الطبيب ونقل المواعيد المستقبلية للطبيب البديل'
        : 'تم تعطيل الطبيب بنجاح',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getOne,
  getMine,
  create,
  update,
  updateMySchedule,
  remove,
};
