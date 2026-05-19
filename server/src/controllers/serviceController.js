const prisma = require('../lib/prisma');
const { getDiscountForService } = require('../services/discountService');

const isMissingServicePriceRangeColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('price_from') || message.includes('price_to');
};

const withLegacyServiceShape = (services = []) =>
  services.map((service) => ({
    ...service,
    priceFrom: service.priceFrom ?? null,
    priceTo: service.priceTo ?? null,
  }));

const getAll = async (req, res, next) => {
  try {
    let services;

    try {
      services = await prisma.service.findMany({ orderBy: { createdAt: 'desc' } });
    } catch (error) {
      if (!isMissingServicePriceRangeColumnError(error)) throw error;

      services = await prisma.service.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          description: true,
          price: true,
          duration: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      services = withLegacyServiceShape(services);
    }

    res.json({ services });
  } catch (error) {
    next(error);
  }
};

const getDiscount = async (req, res, next) => {
  try {
    let service;

    try {
      service = await prisma.service.findUnique({ where: { id: req.params.id } });
    } catch (error) {
      if (!isMissingServicePriceRangeColumnError(error)) throw error;

      service = await prisma.service.findUnique({
        where: { id: req.params.id },
        select: {
          id: true,
          name: true,
          nameAr: true,
          description: true,
          price: true,
          duration: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (service) service = { ...service, priceFrom: null, priceTo: null };
    }

    if (!service) {
      return res.status(404).json({ message: 'الخدمة غير موجودة' });
    }

    const discount = await getDiscountForService({
      patientId: req.query.patientId || null,
      service,
    });

    res.json({ discount });
  } catch (error) {
    next(error);
  }
};

const getPublic = async (req, res, next) => {
  try {
    let services;

    try {
      services = await prisma.service.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          nameAr: true,
          description: true,
          price: true,
          priceFrom: true,
          priceTo: true,
          duration: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      if (!isMissingServicePriceRangeColumnError(error)) throw error;

      services = await prisma.service.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          nameAr: true,
          description: true,
          price: true,
          duration: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      services = withLegacyServiceShape(services);
    }

    res.json({ services });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, nameAr, description, price, priceFrom, priceTo, duration } = req.body;
    let service;

    try {
      service = await prisma.service.create({
        data: { name, nameAr, description, price, priceFrom, priceTo, duration: duration ?? 30 },
      });
    } catch (error) {
      if (!isMissingServicePriceRangeColumnError(error)) throw error;

      service = await prisma.service.create({
        data: { name, nameAr, description, price, duration: duration ?? 30 },
      });

      service = { ...service, priceFrom: null, priceTo: null };
    }

    res.status(201).json({ service });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, nameAr, description, price, priceFrom, priceTo, duration, active } = req.body;
    let service;

    try {
      service = await prisma.service.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(nameAr !== undefined && { nameAr }),
          ...(description !== undefined && { description }),
          ...(price !== undefined && { price }),
          ...(priceFrom !== undefined && { priceFrom }),
          ...(priceTo !== undefined && { priceTo }),
          ...(duration !== undefined && { duration }),
          ...(active !== undefined && { active }),
        },
      });
    } catch (error) {
      if (!isMissingServicePriceRangeColumnError(error)) throw error;

      service = await prisma.service.update({
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

      service = { ...service, priceFrom: null, priceTo: null };
    }

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

module.exports = { getAll, getPublic, getDiscount, create, update, remove };
