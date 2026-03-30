const prisma = require('../lib/prisma');
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

const buildDoctorPatientAccessWhere = (doctorId) => ({
  OR: [
    { appointments: { some: { doctorId } } },
    { consultations: { some: { doctorId } } },
    { prescriptions: { some: { doctorId } } },
  ],
});

const combineWhere = (...filters) => {
  const activeFilters = filters.filter(Boolean);

  if (activeFilters.length === 0) {
    return {};
  }

  if (activeFilters.length === 1) {
    return activeFilters[0];
  }

  return { AND: activeFilters };
};

const getAccessiblePatient = async (req, patientId, include = undefined) => {
  const scopedDoctor = await getScopedDoctor(req);
  const accessWhere = scopedDoctor ? buildDoctorPatientAccessWhere(scopedDoctor.id) : null;

  return prisma.patient.findFirst({
    where: combineWhere({ id: patientId }, accessWhere),
    ...(include ? { include } : {}),
  });
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const { skip, take } = paginate(Number(page), Number(limit));
    const scopedDoctor = await getScopedDoctor(req);

    const searchWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : null;

    const accessWhere = scopedDoctor ? buildDoctorPatientAccessWhere(scopedDoctor.id) : null;
    const where = combineWhere(accessWhere, searchWhere);

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { appointments: true, messages: true } } },
      }),
      prisma.patient.count({ where }),
    ]);

    res.json({
      patients,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const patient = await getAccessiblePatient(req, req.params.id, {
      appointments: {
        include: { doctor: true, service: true },
        orderBy: { scheduledTime: 'desc' },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 50 },
    });

    if (!patient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    res.json({ patient });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, phone, platform, notes } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
    }

    const supportedPlatforms = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];
    const normalizedPlatform = supportedPlatforms.includes(platform) ? platform : 'WHATSAPP';

    const patient = await prisma.patient.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        platform: normalizedPlatform,
        ...(notes !== undefined && { notes }),
      },
    });

    res.status(201).json({ patient });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const existingPatient = await getAccessiblePatient(req, req.params.id);
    if (!existingPatient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    const { name, phone, notes } = req.body;
    if (name !== undefined && !name?.trim()) {
      return res.status(400).json({ error: 'اسم المريض غير صالح' });
    }

    if (phone !== undefined && !phone?.trim()) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }

    const data = {
      ...(name !== undefined && { name: name.trim() }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(notes !== undefined && { notes }),
    };

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
    }

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ patient });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const existingPatient = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existingPatient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    await prisma.patient.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم حذف المريض بنجاح' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getOne, create, update, remove };
