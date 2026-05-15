const prisma = require('../lib/prisma');
const { normalizePhoneDigits } = require('../utils/clinicLinks');
const { paginate } = require('../utils/helpers');

const isMissingDiscountImageColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('image_url');
};

const parseGroupNames = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/[\n,،]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildPhoneLookupWhere = (phone) => {
  const raw = String(phone || '').trim();
  const digits = normalizePhoneDigits(raw);
  const variants = [...new Set([raw, digits, digits ? `+${digits}` : '', digits.startsWith('0') ? digits.slice(1) : ''].filter(Boolean))];
  const suffix = digits.length >= 9 ? digits.slice(-10) : null;

  return {
    OR: [
      ...variants.flatMap((variant) => [{ phone: variant }, { whatsappId: variant }]),
      ...(suffix ? [{ phone: { endsWith: suffix } }, { whatsappId: { endsWith: suffix } }] : []),
    ],
  };
};

const getScopedDoctor = async (req) => {
  if (req.user?.role !== 'DOCTOR') return null;

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
  if (activeFilters.length === 0) return {};
  if (activeFilters.length === 1) return activeFilters[0];
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

const syncPatientGroups = async (tx, patientId, { groupIds, groupNames }, replace = false) => {
  if (replace) {
    await tx.patientGroupMember.deleteMany({ where: { patientId } });
  }

  const incomingGroupIds = Array.isArray(groupIds) ? groupIds.filter(Boolean) : [];
  const incomingGroupNames = parseGroupNames(groupNames);

  for (const groupId of incomingGroupIds) {
    await tx.patientGroupMember.create({ data: { patientId, groupId } }).catch(() => null);
  }

  for (const groupName of incomingGroupNames) {
    const group = await tx.patientGroup.upsert({
      where: { name: groupName },
      update: {},
      create: { name: groupName },
    });
    await tx.patientGroupMember.create({ data: { patientId, groupId: group.id } }).catch(() => null);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, groupId, period, sortBy, profileType } = req.query;
    const { skip, take } = paginate(Number(page), Number(limit));
    const scopedDoctor = await getScopedDoctor(req);

    const searchWhere = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : null;

    const accessWhere = scopedDoctor ? buildDoctorPatientAccessWhere(scopedDoctor.id) : null;
    const groupWhere = groupId ? { groups: { some: { groupId } } } : null;
    let periodWhere = null;
    if (period === 'last7' || period === 'last30') {
      const days = period === 'last7' ? 7 : 30;
      periodWhere = { appointments: { some: { scheduledTime: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } } } };
    }
    if (period === 'thisMonth') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      periodWhere = { appointments: { some: { scheduledTime: { gte: monthStart } } } };
    }

    const profileTypeWhere =
      profileType === 'BOOKED' || profileType === 'LEAD'
        ? { profileType }
        : profileType === 'CONTACT_ONLY'
          ? { profileType: 'LEAD' }
          : null;

    const where = combineWhere(accessWhere, searchWhere, groupWhere, periodWhere, profileTypeWhere);
    const orderBy =
      sortBy === 'mostBooked'
        ? { appointments: { _count: 'desc' } }
        : sortBy === 'leastBooked'
          ? { appointments: { _count: 'asc' } }
          : { createdAt: 'desc' };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          groups: { include: { group: true } },
          _count: { select: { appointments: true, messages: true } },
        },
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
      consultations: {
        include: { doctor: { select: { name: true, specialization: true } } },
        orderBy: { createdAt: 'desc' },
      },
      prescriptions: {
        include: { doctor: { select: { name: true, specialization: true } } },
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        include: {
          service: true,
          appointment: {
            include: { doctor: true, service: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      groups: { include: { group: true } },
    });

    if (!patient) return res.status(404).json({ error: 'المريض غير موجود' });
    res.json({ patient });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const {
      name,
      displayName,
      phone,
      email,
      age,
      gender,
      platform,
      notes,
      accountNotes,
      accountBalance,
      accountingNotes,
      totalSpent,
      lastPaymentDate,
      creditBalance,
      profileType,
      groupIds,
      groupNames,
    } = req.body;

    if (!name?.trim() || !phone?.trim()) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
    }

    const supportedPlatforms = ['WHATSAPP', 'FACEBOOK', 'INSTAGRAM'];
    const normalizedPlatform = supportedPlatforms.includes(platform) ? platform : 'WHATSAPP';

    const patient = await prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          name: name.trim(),
          displayName: displayName?.trim() || null,
          phone: phone.trim(),
          email: email?.trim() || null,
          age: age !== undefined && age !== '' ? Number(age) || null : null,
          gender: gender?.trim() || null,
          platform: normalizedPlatform,
          notes: notes || null,
          accountNotes: accountNotes || null,
          accountBalance: Number(accountBalance) || 0,
          accountingNotes: accountingNotes || accountNotes || null,
          totalSpent: Number(totalSpent) || 0,
          lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
          creditBalance: Number(creditBalance) || 0,
          profileType: profileType === 'BOOKED' ? 'BOOKED' : 'LEAD',
        },
      });

      await syncPatientGroups(tx, created.id, { groupIds, groupNames }, false);

      return tx.patient.findUnique({
        where: { id: created.id },
        include: { groups: { include: { group: true } } },
      });
    });

    res.status(201).json({ patient });
  } catch (error) {
    if (error?.code === 'P2002') {
      try {
        const existingPatient = await prisma.patient.findUnique({
          where: { phone: String(req.body?.phone || '').trim() },
          include: { groups: { include: { group: true } } },
        });

        if (existingPatient) {
          return res.status(409).json({
            error: 'يوجد مريض مسجل بالفعل بنفس رقم الهاتف',
            patient: existingPatient,
          });
        }
      } catch (lookupError) {
        console.error('Patient duplicate lookup error:', lookupError.message);
      }
    }
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const existingPatient = await getAccessiblePatient(req, req.params.id);
    if (!existingPatient) return res.status(404).json({ error: 'المريض غير موجود' });

    const {
      name,
      displayName,
      phone,
      email,
      age,
      gender,
      notes,
      accountNotes,
      accountBalance,
      accountingNotes,
      totalSpent,
      lastPaymentDate,
      creditBalance,
      groupIds,
      groupNames,
    } = req.body;
    if (name !== undefined && !name?.trim()) return res.status(400).json({ error: 'اسم المريض غير صالح' });
    if (phone !== undefined && !phone?.trim()) return res.status(400).json({ error: 'رقم الهاتف غير صالح' });

    const data = {
      ...(name !== undefined && { name: name.trim() }),
      ...(displayName !== undefined && { displayName: displayName?.trim() || null }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(age !== undefined && { age: age === '' || age === null ? null : Number(age) || null }),
      ...(gender !== undefined && { gender: gender?.trim() || null }),
      ...(notes !== undefined && { notes }),
      ...(accountNotes !== undefined && { accountNotes }),
      ...(accountBalance !== undefined && { accountBalance: Number(accountBalance) || 0 }),
      ...(accountingNotes !== undefined && { accountingNotes }),
      ...(totalSpent !== undefined && { totalSpent: Number(totalSpent) || 0 }),
      ...(lastPaymentDate !== undefined && { lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null }),
      ...(creditBalance !== undefined && { creditBalance: Number(creditBalance) || 0 }),
    };
    const shouldUpdateGroups = groupIds !== undefined || groupNames !== undefined;

    if (Object.keys(data).length === 0 && !shouldUpdateGroups) {
      return res.status(400).json({ error: 'لا توجد بيانات للتحديث' });
    }

    const patient = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.patient.update({ where: { id: req.params.id }, data });
      }
      if (shouldUpdateGroups) {
        await syncPatientGroups(tx, req.params.id, { groupIds, groupNames }, true);
      }
      return tx.patient.findUnique({
        where: { id: req.params.id },
        include: { groups: { include: { group: true } } },
      });
    });

    res.json({ patient });
  } catch (error) {
    next(error);
  }
};

const saveTeethNotes = async (req, res, next) => {
  try {
    const existingPatient = await getAccessiblePatient(req, req.params.id);
    if (!existingPatient) return res.status(404).json({ error: 'المريض غير موجود' });

    const rawTeeth = req.body?.teeth && typeof req.body.teeth === 'object' ? req.body.teeth : {};
    const teeth = {};
    for (const [key, value] of Object.entries(rawTeeth)) {
      if (!/^\d{1,2}$/.test(String(key))) continue;
      const note = value === null || value === undefined ? '' : String(value).trim();
      if (note) teeth[String(key)] = note;
    }

    const patient = await prisma.patient.update({
      where: { id: req.params.id },
      data: { teethNotes: teeth },
      select: { id: true, teethNotes: true },
    });

    res.json({ patient, teeth: patient.teethNotes || {} });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const existingPatient = await prisma.patient.findUnique({ where: { id: req.params.id } });
    if (!existingPatient) return res.status(404).json({ error: 'المريض غير موجود' });

    await prisma.patient.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم حذف المريض بنجاح' });
  } catch (error) {
    next(error);
  }
};

const listGroups = async (req, res, next) => {
  try {
    const groups = await prisma.patientGroup.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
    res.json({ groups });
  } catch (error) {
    next(error);
  }
};

const createGroup = async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'اسم المجموعة مطلوب' });

    const group = await prisma.patientGroup.create({
      data: { name, description: req.body.description || null },
    });
    res.status(201).json({ group });
  } catch (error) {
    next(error);
  }
};

const bulkImport = async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body.patients) ? req.body.patients : [];
    const defaultGroupNames = parseGroupNames(req.body.groupNames);

    if (rows.length === 0) return res.status(400).json({ error: 'قائمة المرضى مطلوبة' });

    const summary = { total: rows.length, created: 0, updated: 0, failed: 0, errors: [] };
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const name = String(row.name || '').trim();
        const phone = String(row.phone || '').trim();
        if (!name || !phone) {
          summary.failed++;
          summary.errors.push({ row: index + 1, error: 'الاسم والهاتف مطلوبان' });
          continue;
        }

        const exists = await tx.patient.findFirst({ where: { phone } });

        const patient = exists
          ? await tx.patient.update({
              where: { id: exists.id },
              data: {
                name,
                ...(row.displayName !== undefined && { displayName: String(row.displayName || '').trim() || null }),
                ...(row.notes !== undefined && { notes: String(row.notes || '') }),
                ...(row.email !== undefined && { email: String(row.email || '').trim() || null }),
                ...(row.age !== undefined && { age: row.age === '' || row.age === null ? null : Number(row.age) || null }),
                ...(row.gender !== undefined && { gender: String(row.gender || '').trim() || null }),
              },
            })
          : await tx.patient.create({
              data: {
                name,
                phone,
                displayName: String(row.displayName || '').trim() || null,
                email: String(row.email || '').trim() || null,
                age: row.age === '' || row.age === null || row.age === undefined ? null : Number(row.age) || null,
                gender: String(row.gender || '').trim() || null,
                notes: row.notes || null,
                platform: row.platform || 'WHATSAPP',
              },
            });

        await syncPatientGroups(
          tx,
          patient.id,
          { groupNames: [...defaultGroupNames, ...parseGroupNames(row.groupNames)] },
          false
        );
        if (exists) summary.updated++;
        else summary.created++;
      }
    });

    res.json({ success: true, summary, processed: summary.created + summary.updated });
  } catch (error) {
    next(error);
  }
};

const listDiscounts = async (req, res, next) => {
  try {
    let discounts;
    try {
      discounts = await prisma.discountRule.findMany({
        orderBy: { createdAt: 'desc' },
        include: { group: true },
      });
    } catch (error) {
      if (!isMissingDiscountImageColumnError(error)) throw error;
      discounts = await prisma.discountRule.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          value: true,
          active: true,
          groupId: true,
          serviceId: true,
          serviceName: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
          updatedAt: true,
          group: true,
        },
      });
      discounts = discounts.map((discount) => ({ ...discount, imageUrl: null }));
    }
    res.json({ discounts });
  } catch (error) {
    next(error);
  }
};

const saveDiscount = async (req, res, next) => {
  try {
    const phoneNumbers = Array.isArray(req.body.phoneNumbers)
      ? req.body.phoneNumbers.map((item) => String(item || '').trim()).filter(Boolean)
      : String(req.body.phoneNumbers || '')
          .split(/[\n,،]+/)
          .map((item) => item.trim())
          .filter(Boolean);

    const data = {
      name: req.body.name?.trim(),
      type: req.body.type === 'FIXED' ? 'FIXED' : 'PERCENT',
      value: Number(req.body.value),
      imageUrl: req.body.imageUrl?.trim() || null,
      active: req.body.active !== undefined ? Boolean(req.body.active) : true,
      groupId: req.body.groupId || null,
      serviceId: req.body.serviceId || null,
      serviceName: req.body.serviceName || null,
      startsAt: req.body.startsAt ? new Date(req.body.startsAt) : null,
      endsAt: req.body.endsAt ? new Date(req.body.endsAt) : null,
    };

    if (!data.name || !Number.isFinite(data.value) || data.value <= 0) {
      return res.status(400).json({ error: 'اسم الخصم وقيمته مطلوبان' });
    }

    if (phoneNumbers.length > 0) {
      const groupName = req.body.groupName?.trim() || `${data.name} - أرقام محددة`;
      const group = await prisma.patientGroup.upsert({
        where: { name: groupName },
        update: { description: req.body.groupDescription || null },
        create: { name: groupName, description: req.body.groupDescription || null },
      });

      for (const phone of phoneNumbers) {
        const digits = normalizePhoneDigits(phone);
        const patient =
          (await prisma.patient.findFirst({
            where: buildPhoneLookupWhere(phone),
            orderBy: { createdAt: 'asc' },
          })) ||
          (await prisma.patient.create({
            data: {
              name: phone,
              phone: digits || phone,
              platform: 'WHATSAPP',
              ...(digits ? { whatsappId: digits } : {}),
            },
          }));
        await prisma.patientGroupMember.create({ data: { patientId: patient.id, groupId: group.id } }).catch(() => null);
      }

      data.groupId = group.id;
    }

    let discount;
    try {
      discount = req.params.id
        ? await prisma.discountRule.update({ where: { id: req.params.id }, data, include: { group: true } })
        : await prisma.discountRule.create({ data, include: { group: true } });
    } catch (error) {
      if (!isMissingDiscountImageColumnError(error)) throw error;
      const legacyData = { ...data };
      delete legacyData.imageUrl;
      discount = req.params.id
        ? await prisma.discountRule.update({ where: { id: req.params.id }, data: legacyData, include: { group: true } })
        : await prisma.discountRule.create({ data: legacyData, include: { group: true } });
      discount = { ...discount, imageUrl: null };
    }

    res.status(req.params.id ? 200 : 201).json({ discount });
  } catch (error) {
    next(error);
  }
};

const removeDiscount = async (req, res, next) => {
  try {
    await prisma.discountRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAll,
  getOne,
  create,
  update,
  saveTeethNotes,
  remove,
  listGroups,
  createGroup,
  bulkImport,
  listDiscounts,
  saveDiscount,
  removeDiscount,
};
