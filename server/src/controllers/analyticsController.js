const prisma = require('../lib/prisma');

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

const getDoctorPatientIds = async (doctorId) => {
  const [appointments, consultations, prescriptions] = await Promise.all([
    prisma.appointment.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
    prisma.consultation.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
    prisma.prescription.findMany({
      where: { doctorId },
      select: { patientId: true },
      distinct: ['patientId'],
    }),
  ]);

  return [...new Set([...appointments, ...consultations, ...prescriptions].map((item) => item.patientId))];
};

const buildCountArg = (field, dateFilter) => (Object.keys(dateFilter).length > 0 ? { where: { [field]: dateFilter } } : {});

const getStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const createdAtFilter = {};
    const hasDateFilter = !!(from || to);

    if (from) createdAtFilter.gte = new Date(from);
    if (to) createdAtFilter.lte = new Date(to);

    const scopedDoctor = await getScopedDoctor(req);
    const appointmentWhere = {
      ...(scopedDoctor ? { doctorId: scopedDoctor.id } : {}),
      ...(hasDateFilter ? { createdAt: createdAtFilter } : {}),
    };

    const patientIds = scopedDoctor ? await getDoctorPatientIds(scopedDoctor.id) : null;
    const messageWhere = {
      ...(patientIds ? { patientId: { in: patientIds } } : {}),
      ...(hasDateFilter ? { createdAt: createdAtFilter } : {}),
    };

    const totalPatients = patientIds ? patientIds.length : await prisma.patient.count(buildCountArg('createdAt', createdAtFilter));
    const totalAppointments = await prisma.appointment.count({ where: appointmentWhere });
    const totalMessages = patientIds && patientIds.length === 0 ? 0 : await prisma.message.count({ where: messageWhere });

    const appointmentsByStatus = await prisma.appointment.groupBy({
      by: ['status'],
      _count: true,
      where: appointmentWhere,
    });

    const messagesByPlatform =
      patientIds && patientIds.length === 0
        ? []
        : await prisma.message.groupBy({
            by: ['platform'],
            _count: true,
            where: messageWhere,
          });

    const recentAppointments = await prisma.appointment.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      where: appointmentWhere,
      include: {
        patient: { select: { name: true, phone: true } },
        doctor: { select: { name: true } },
        service: { select: { nameAr: true } },
      },
    });

    const topServices = await prisma.appointment.groupBy({
      by: ['serviceId'],
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
      where: appointmentWhere,
    });

    const serviceIds = topServices.map((service) => service.serviceId);
    const services = serviceIds.length
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, nameAr: true },
        })
      : [];

    const topServicesWithNames = topServices.map((service) => ({
      ...service,
      serviceName: services.find((svc) => svc.id === service.serviceId)?.nameAr || 'غير معروف',
    }));

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyAppointments = await prisma.appointment.groupBy({
      by: ['status'],
      _count: true,
      where: {
        ...(scopedDoctor ? { doctorId: scopedDoctor.id } : {}),
        createdAt: { gte: sixMonthsAgo },
      },
    });

    res.json({
      overview: {
        totalPatients,
        totalAppointments,
        totalMessages,
      },
      appointmentsByStatus: appointmentsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      messagesByPlatform: messagesByPlatform.reduce((acc, item) => {
        acc[item.platform] = item._count;
        return acc;
      }, {}),
      recentAppointments,
      topServices: topServicesWithNames,
      monthlyAppointments,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStats };
