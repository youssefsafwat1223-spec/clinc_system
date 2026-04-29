const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const STAFF_ROLES = ['ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'];

const selectUser = {
  id: true,
  name: true,
  displayName: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  doctor: { select: { id: true, phone: true, specialization: true, active: true } },
};

const normalizeRole = (role) => (STAFF_ROLES.includes(role) ? role : 'STAFF');

const list = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      select: selectUser,
    });

    res.json({
      staff: users.map((user) => ({
        ...user,
        phone: user.doctor?.phone || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, displayName, email, password, role, phone } = req.body;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'الاسم والبريد وكلمة المرور مطلوبة' });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        displayName: displayName?.trim() || name.trim(),
        email: email.trim().toLowerCase(),
        password: await bcrypt.hash(password, 12),
        role: normalizeRole(role),
        ...(normalizeRole(role) === 'DOCTOR'
          ? {
              doctor: {
                create: {
                  name: name.trim(),
                  specialization: req.body.specialization || 'طبيب',
                  phone: phone || null,
                  workingHours: {},
                },
              },
            }
          : {}),
      },
      select: selectUser,
    });

    res.status(201).json({ staff: { ...user, phone: user.doctor?.phone || phone || null } });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, displayName, email, password, role, phone, active } = req.body;
    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { doctor: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }

    const nextRole = role ? normalizeRole(role) : existing.role;
    const user = await prisma.$transaction(async (tx) => {
      const data = {
        ...(name !== undefined && { name: name.trim() }),
        ...(displayName !== undefined && { displayName: displayName?.trim() || null }),
        ...(email !== undefined && email && { email: email.trim().toLowerCase() }),
        ...(role !== undefined && { role: nextRole }),
        ...(active !== undefined && { active: Boolean(active) }),
      };

      if (password?.trim()) {
        data.password = await bcrypt.hash(password, 12);
      }

      await tx.user.update({ where: { id: req.params.id }, data });

      if (nextRole === 'DOCTOR') {
        if (existing.doctor) {
          await tx.doctor.update({
            where: { id: existing.doctor.id },
            data: {
              ...(name !== undefined && { name: name.trim() }),
              ...(phone !== undefined && { phone: phone || null }),
              active: active !== undefined ? Boolean(active) : existing.doctor.active,
            },
          });
        } else {
          await tx.doctor.create({
            data: {
              userId: req.params.id,
              name: name?.trim() || existing.name,
              specialization: req.body.specialization || 'طبيب',
              phone: phone || null,
              workingHours: {},
            },
          });
        }
      } else if (existing.doctor && phone !== undefined) {
        await tx.doctor.update({ where: { id: existing.doctor.id }, data: { phone: phone || null } });
      }

      return tx.user.findUnique({ where: { id: req.params.id }, select: selectUser });
    });

    res.json({ staff: { ...user, phone: user.doctor?.phone || phone || null } });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id }, include: { doctor: true } });
    if (!existing) {
      return res.status(404).json({ error: 'الموظف غير موجود' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: req.params.id }, data: { active: false } });
      if (existing.doctor) {
        await tx.doctor.update({ where: { id: existing.doctor.id }, data: { active: false } });
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
