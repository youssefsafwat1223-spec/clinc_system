const prisma = require('../lib/prisma');

const isMissingDiscountImageColumnError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('image_url');
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getActiveDiscountRules = async ({ patientId, serviceId, serviceName, serviceNameAr }) => {
  const memberships = patientId
    ? await prisma.patientGroupMember.findMany({
        where: { patientId },
        select: { groupId: true },
      })
    : [];

  const groupIds = memberships.map((membership) => membership.groupId);
  const now = new Date();

  try {
    return await prisma.discountRule.findMany({
      where: {
        active: true,
        OR: [{ groupId: null }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])],
        AND: [
          {
            OR: [
              { serviceId: null },
              ...(serviceId ? [{ serviceId }] : []),
              ...(serviceName ? [{ serviceName }] : []),
              ...(serviceNameAr ? [{ serviceName: serviceNameAr }] : []),
            ],
          },
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: { group: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    if (!isMissingDiscountImageColumnError(error)) throw error;

    const rules = await prisma.discountRule.findMany({
      where: {
        active: true,
        OR: [{ groupId: null }, ...(groupIds.length ? [{ groupId: { in: groupIds } }] : [])],
        AND: [
          {
            OR: [
              { serviceId: null },
              ...(serviceId ? [{ serviceId }] : []),
              ...(serviceName ? [{ serviceName }] : []),
              ...(serviceNameAr ? [{ serviceName: serviceNameAr }] : []),
            ],
          },
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
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

    return rules.map((rule) => ({ ...rule, imageUrl: null }));
  }
};

const calculateRuleDiscount = (amount, rule) => {
  const value = toNumber(rule.value);
  if (value <= 0) return 0;
  if (rule.type === 'FIXED') return value;
  return (amount * value) / 100;
};

const getDiscountForService = async ({ patientId, service }) => {
  const amount = toNumber(service?.price);
  if (amount <= 0) {
    return {
      amount,
      discountAmount: 0,
      finalAmount: amount,
      rule: null,
    };
  }

  const rules = await getActiveDiscountRules({
    patientId,
    serviceId: service?.id,
    serviceName: service?.name,
    serviceNameAr: service?.nameAr,
  });

  if (!rules.length) {
    return {
      amount,
      discountAmount: 0,
      finalAmount: amount,
      rule: null,
    };
  }

  const best = rules
    .map((rule) => ({
      rule,
      discountAmount: Math.max(0, Math.min(amount, calculateRuleDiscount(amount, rule))),
    }))
    .sort((a, b) => b.discountAmount - a.discountAmount)[0];

  return {
    amount,
    discountAmount: best.discountAmount,
    finalAmount: Math.max(0, amount - best.discountAmount),
    rule: best.rule,
  };
};

const getDiscountForAppointment = async (appointment) =>
  getDiscountForService({
    patientId: appointment?.patientId,
    service: appointment?.service,
  });

module.exports = {
  toNumber,
  getDiscountForService,
  getDiscountForAppointment,
};
