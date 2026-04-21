const prisma = require('../lib/prisma');

const getAll = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ services });
  } catch (error) {
    next(error);
  }
};

const getPublic = async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true, nameAr: true, description: true, price: true, duration: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ services });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, nameAr, description, price, duration } = req.body;
    const service = await prisma.service.create({
      data: { name, nameAr, description, price, duration: duration ?? 30 },
    });
    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, nameAr, description, price, duration, active } = req.body;
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(duration !== undefined && { duration }),
        ...(active !== undefined && { active }),
      },
    });
    res.json({ service });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم حذف الخدمة بنجاح' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, getPublic, create, update, remove };
