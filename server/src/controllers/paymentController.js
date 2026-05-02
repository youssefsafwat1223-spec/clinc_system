const prisma = require('../lib/prisma');
const { getDiscountForAppointment, toNumber } = require('../services/discountService');

const resolveStatus = (paidAmount, finalAmount, explicitStatus) => {
  if (['UNPAID', 'PARTIAL', 'PAID'].includes(explicitStatus)) return explicitStatus;
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount < finalAmount) return 'PARTIAL';
  return 'PAID';
};

const buildPaymentData = async (appointment, body = {}) => {
  const amount = body.amount !== undefined ? toNumber(body.amount) : toNumber(appointment.service?.price);
  const discountAmount =
    body.discountAmount !== undefined
      ? toNumber(body.discountAmount)
      : (await getDiscountForAppointment(appointment)).discountAmount;
  const finalAmount = Math.max(0, amount - Math.max(0, discountAmount));
  const paidAmount = Math.max(0, toNumber(body.paidAmount));
  const status = resolveStatus(paidAmount, finalAmount, body.status);

  return {
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    serviceId: appointment.serviceId || null,
    amount,
    discountAmount: Math.min(amount, Math.max(0, discountAmount)),
    finalAmount,
    paidAmount,
    status,
    method: body.method || null,
    notes: body.notes || null,
    paidAt: paidAmount > 0 ? new Date() : null,
  };
};

const recalculatePatientAccount = async (patientId) => {
  const payments = await prisma.payment.findMany({
    where: { patientId },
    select: { finalAmount: true, paidAmount: true, paidAt: true },
  });

  const totalSpent = payments.reduce((sum, payment) => sum + toNumber(payment.paidAmount), 0);
  const creditBalance = payments.reduce(
    (sum, payment) => sum + Math.max(0, toNumber(payment.finalAmount) - toNumber(payment.paidAmount)),
    0
  );
  const lastPayment = payments
    .filter((payment) => payment.paidAt)
    .sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime())[0];

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      totalSpent,
      creditBalance,
      accountBalance: creditBalance,
      lastPaymentDate: lastPayment?.paidAt || null,
    },
  });
};

const serializeAppointmentPayment = async (appointment) => {
  if (appointment.payment) {
    return appointment.payment;
  }

  const data = await buildPaymentData(appointment);
  return prisma.payment.create({ data });
};

const list = async (req, res, next) => {
  try {
    const { status, search, month, limit = 100 } = req.query;
    const filters = [];

    if (status && status !== 'ALL') {
      filters.push(
        status === 'UNPAID'
          ? { OR: [{ payment: { is: { status } } }, { payment: { is: null } }] }
          : { payment: { is: { status } } }
      );
    }

    if (search) {
      filters.push({
        OR: [
          { bookingRef: { contains: search, mode: 'insensitive' } },
          { id: { contains: search, mode: 'insensitive' } },
          { patient: { name: { contains: search, mode: 'insensitive' } } },
          { patient: { phone: { contains: search } } },
        ],
      });
    }

    if (month) {
      const monthStart = new Date(`${month}-01T00:00:00`);
      if (!Number.isNaN(monthStart.getTime())) {
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        filters.push({ scheduledTime: { gte: monthStart, lt: monthEnd } });
      }
    }

    const where = filters.length ? { AND: filters } : {};

    const appointments = await prisma.appointment.findMany({
      where,
      take: Math.min(Number(limit) || 100, 300),
      orderBy: { scheduledTime: 'desc' },
      include: {
        patient: true,
        doctor: true,
        service: true,
        payment: true,
      },
    });

    const rows = [];
    for (const appointment of appointments) {
      const payment = await serializeAppointmentPayment(appointment);
      rows.push({ ...payment, appointment });
    }

    const summary = rows.reduce(
      (acc, payment) => {
        acc.totalPaid += toNumber(payment.paidAmount);
        acc.totalRemaining += Math.max(0, toNumber(payment.finalAmount) - toNumber(payment.paidAmount));
        acc.totalDiscount += toNumber(payment.discountAmount);
        acc.paidCount += payment.status === 'PAID' ? 1 : 0;
        acc.unpaidCount += payment.status === 'UNPAID' ? 1 : 0;
        acc.partialCount += payment.status === 'PARTIAL' ? 1 : 0;
        return acc;
      },
      { totalPaid: 0, totalRemaining: 0, totalDiscount: 0, paidCount: 0, unpaidCount: 0, partialCount: 0 }
    );

    res.json({ payments: rows, summary });
  } catch (error) {
    next(error);
  }
};

const upsertByAppointment = async (req, res, next) => {
  try {
    const { appointmentId } = req.body;
    if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true, service: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const data = await buildPaymentData(appointment, req.body);
    const payment = await prisma.payment.upsert({
      where: { appointmentId },
      update: data,
      create: data,
      include: { appointment: { include: { patient: true, doctor: true, service: true } } },
    });

    await recalculatePatientAccount(payment.patientId);
    res.status(201).json({ payment });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const existing = await prisma.payment.findUnique({
      where: { id: req.params.id },
      include: { appointment: { include: { service: true } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const data = await buildPaymentData(existing.appointment, {
      amount: req.body.amount ?? existing.amount,
      discountAmount: req.body.discountAmount ?? existing.discountAmount,
      paidAmount: req.body.paidAmount ?? existing.paidAmount,
      status: req.body.status,
      method: req.body.method ?? existing.method,
      notes: req.body.notes ?? existing.notes,
    });

    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data,
      include: { appointment: { include: { patient: true, doctor: true, service: true } } },
    });

    await recalculatePatientAccount(payment.patientId);
    res.json({ payment });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, upsertByAppointment, update };
