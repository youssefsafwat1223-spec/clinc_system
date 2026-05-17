const prisma = require('../lib/prisma');
const { getDiscountForAppointment, toNumber } = require('../services/discountService');
const whatsappService = require('../services/whatsappService');

const resolveStatus = (paidAmount, finalAmount, explicitStatus) => {
  if (['UNPAID', 'PARTIAL', 'PAID'].includes(explicitStatus)) return explicitStatus;
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount < finalAmount) return 'PARTIAL';
  return 'PAID';
};

const buildPaymentData = async (appointment, body = {}) => {
  const amount = body.amount !== undefined ? toNumber(body.amount) : toNumber(appointment.service?.price);
  const teethCount =
    body.teethCount !== undefined ? Math.max(1, Math.floor(toNumber(body.teethCount) || 1)) : undefined;
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
    ...(teethCount !== undefined && { teethCount }),
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
    const { status, search, month, from, to, limit = 100 } = req.query;
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

    if (from || to) {
      const range = {};
      if (from) {
        const fromDate = new Date(`${from}T00:00:00`);
        if (!Number.isNaN(fromDate.getTime())) range.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59.999`);
        if (!Number.isNaN(toDate.getTime())) range.lte = toDate;
      }
      if (range.gte || range.lte) filters.push({ scheduledTime: range });
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

const revenueReport = async (req, res, next) => {
  try {
    const {
      from,
      to,
      status,
      paymentStatus,
      method,
      caseStatus,
      search,
      patientId,
      cashierExpenses = 0,
      limit = 500,
    } = req.query;

    const filters = [];
    const appointmentFilters = [];
    const resolvedStatus = paymentStatus || status;

    // Case status maps to the underlying appointment status.
    const caseStatusMap = {
      WASEL: ['COMPLETED'],
      MUNTAHI: ['EXPIRED', 'CANCELLED', 'REJECTED', 'NO_SHOW'],
      MOSTAMERA: ['PENDING', 'CONFIRMED'],
    };
    if (caseStatus && caseStatusMap[caseStatus]) {
      appointmentFilters.push({ status: { in: caseStatusMap[caseStatus] } });
    }

    if (patientId) filters.push({ patientId });
    if (resolvedStatus && resolvedStatus !== 'ALL') filters.push({ status: resolvedStatus });
    if (method && method !== 'ALL') filters.push({ method });

    if (from || to) {
      const range = {};
      if (from) {
        const fromDate = new Date(`${from}T00:00:00`);
        if (!Number.isNaN(fromDate.getTime())) range.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59.999`);
        if (!Number.isNaN(toDate.getTime())) range.lte = toDate;
      }
      if (range.gte || range.lte) appointmentFilters.push({ scheduledTime: range });
    }

    if (search) {
      appointmentFilters.push({
        OR: [
          { bookingRef: { contains: search, mode: 'insensitive' } },
          { patient: { name: { contains: search, mode: 'insensitive' } } },
          { patient: { displayName: { contains: search, mode: 'insensitive' } } },
          { patient: { phone: { contains: search } } },
          { service: { name: { contains: search, mode: 'insensitive' } } },
          { service: { nameAr: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    if (appointmentFilters.length) {
      filters.push({ appointment: { AND: appointmentFilters } });
    }

    const where = filters.length ? { AND: filters } : {};
    const payments = await prisma.payment.findMany({
      where,
      take: Math.min(Number(limit) || 500, 1000),
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        patient: true,
        service: true,
        appointment: { include: { patient: true, doctor: true, service: true } },
      },
    });

    const rowsMap = new Map();
    const patientPaidIds = new Set();
    const patientDebtIds = new Set();

    const summary = payments.reduce(
      (acc, payment) => {
        const finalAmount = toNumber(payment.finalAmount);
        const paidAmount = toNumber(payment.paidAmount);
        const remaining = Math.max(0, finalAmount - paidAmount);
        const teethCount = Math.max(1, Number(payment.teethCount || 1));
        const service = payment.service || payment.appointment?.service;
        const serviceId = service?.id || 'unknown';
        const serviceName = service?.nameAr || service?.name || 'خدمة غير محددة';

        if (!rowsMap.has(serviceId)) {
          rowsMap.set(serviceId, {
            serviceId,
            serviceName,
            caseType: serviceName,
            netAmount: 0,
            debtAmount: 0,
            receivedAmount: 0,
            caseCount: 0,
            teethCount: 0,
          });
        }

        const row = rowsMap.get(serviceId);
        row.netAmount += finalAmount;
        row.debtAmount += remaining;
        row.receivedAmount += paidAmount;
        row.caseCount += 1;
        row.teethCount += teethCount;

        acc.totalRevenue += finalAmount;
        acc.totalReceived += paidAmount;
        acc.totalDebt += remaining;
        acc.caseCount += 1;
        if (paidAmount > 0) {
          acc.casesWithPayments += 1;
          patientPaidIds.add(payment.patientId);
        } else {
          acc.casesWithoutPayments += 1;
        }
        if (remaining > 0) patientDebtIds.add(payment.patientId);
        return acc;
      },
      {
        totalRevenue: 0,
        totalReceived: 0,
        totalDebt: 0,
        totalProfit: 0,
        caseCount: 0,
        casesWithPayments: 0,
        casesWithoutPayments: 0,
        patientsWithPayments: 0,
        patientsWithDebts: 0,
        cashierExpenses: Math.max(0, Number(cashierExpenses) || 0),
      }
    );

    // ── Extra charges (standalone services with an amount) ──
    const extraWhere = [];
    if (patientId) extraWhere.push({ patientId });
    if (resolvedStatus && resolvedStatus !== 'ALL') extraWhere.push({ status: resolvedStatus });
    if (method && method !== 'ALL') extraWhere.push({ method });
    {
      const range = {};
      if (from) {
        const d = new Date(`${from}T00:00:00`);
        if (!Number.isNaN(d.getTime())) range.gte = d;
      }
      if (to) {
        const d = new Date(`${to}T23:59:59.999`);
        if (!Number.isNaN(d.getTime())) range.lte = d;
      }
      if (range.gte || range.lte) extraWhere.push({ createdAt: range });
    }
    if (search) {
      extraWhere.push({
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { patient: { name: { contains: search, mode: 'insensitive' } } },
          { patient: { displayName: { contains: search, mode: 'insensitive' } } },
          { patient: { phone: { contains: search } } },
          { service: { name: { contains: search, mode: 'insensitive' } } },
          { service: { nameAr: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    const extraCharges = await prisma.extraCharge.findMany({
      where: extraWhere.length ? { AND: extraWhere } : {},
      take: 1000,
      orderBy: { createdAt: 'desc' },
      include: { patient: true, service: true, doctor: true },
    });

    const extraDetails = extraCharges.map((extra) => {
      const finalAmount = toNumber(extra.amount);
      const paidAmount = toNumber(extra.paidAmount);
      const remaining = Math.max(0, finalAmount - paidAmount);
      const teethCount = Math.max(1, Number(extra.teethCount || 1));
      const serviceName = extra.service?.nameAr || extra.service?.name || extra.description || 'خدمة إضافية';
      const serviceKey = extra.service?.id || 'extra-misc';

      if (!rowsMap.has(serviceKey)) {
        rowsMap.set(serviceKey, {
          serviceId: serviceKey,
          serviceName,
          caseType: serviceName,
          netAmount: 0,
          debtAmount: 0,
          receivedAmount: 0,
          caseCount: 0,
          teethCount: 0,
        });
      }
      const row = rowsMap.get(serviceKey);
      row.netAmount += finalAmount;
      row.debtAmount += remaining;
      row.receivedAmount += paidAmount;
      row.caseCount += 1;
      row.teethCount += teethCount;

      summary.totalRevenue += finalAmount;
      summary.totalReceived += paidAmount;
      summary.totalDebt += remaining;
      summary.caseCount += 1;
      if (paidAmount > 0) {
        summary.casesWithPayments += 1;
        patientPaidIds.add(extra.patientId);
      } else {
        summary.casesWithoutPayments += 1;
      }
      if (remaining > 0) patientDebtIds.add(extra.patientId);

      return {
        id: extra.id,
        source: 'extra',
        patientId: extra.patientId,
        patientName: extra.patient?.displayName || extra.patient?.name || '',
        patientPhone: extra.patient?.phone || '',
        treatmentType: serviceName,
        doctorName: extra.doctor?.name || '',
        amount: finalAmount,
        baseAmount: finalAmount,
        discountAmount: 0,
        teethCount,
        paidAmount,
        remainingAmount: remaining,
        paymentDate: extra.createdAt,
        method: extra.method,
        status: extra.status,
        notes: extra.notes || '',
      };
    });

    summary.totalProfit = summary.totalRevenue - summary.cashierExpenses;
    summary.patientsWithPayments = patientPaidIds.size;
    summary.patientsWithDebts = patientDebtIds.size;

    res.json({
      summary,
      rows: Array.from(rowsMap.values()).sort((a, b) => b.receivedAmount - a.receivedAmount),
      payments: [
        ...extraDetails,
        ...payments.map((payment) => ({
        source: 'payment',
        id: payment.id,
        appointmentId: payment.appointmentId,
        appointmentStatus: payment.appointment?.status || null,
        caseStatus:
          payment.appointment?.status === 'COMPLETED'
            ? 'WASEL'
            : ['EXPIRED', 'CANCELLED', 'REJECTED', 'NO_SHOW'].includes(payment.appointment?.status)
              ? 'MUNTAHI'
              : payment.appointment?.status
                ? 'MOSTAMERA'
                : null,
        patientId: payment.patientId,
        patientName: payment.patient?.displayName || payment.patient?.name || payment.appointment?.patient?.name || '',
        patientPhone: payment.patient?.phone || payment.appointment?.patient?.phone || '',
        treatmentType: payment.service?.nameAr || payment.service?.name || payment.appointment?.service?.nameAr || payment.appointment?.service?.name || '',
        doctorName: payment.appointment?.doctor?.name || '',
        amount: toNumber(payment.finalAmount),
        baseAmount: toNumber(payment.amount),
        discountAmount: toNumber(payment.discountAmount),
        teethCount: Math.max(1, Number(payment.teethCount || 1)),
        paidAmount: toNumber(payment.paidAmount),
        remainingAmount: Math.max(0, toNumber(payment.finalAmount) - toNumber(payment.paidAmount)),
        paymentDate: payment.paidAt || payment.createdAt,
        method: payment.method,
        status: payment.status,
      })),
      ],
    });
  } catch (error) {
    next(error);
  }
};

const extraStatus = (paidAmount, amount) => {
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount < amount) return 'PARTIAL';
  return 'PAID';
};

const money = (value) => `${Number(value || 0).toLocaleString('ar-IQ')} د.ع`;

const formatReceiptDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const buildReceiptMessage = ({ id, patient, serviceName, doctorName, amount, paidAmount, remainingAmount, method, date }) => {
  const clinicName = 'عيادة د. إبراهيم التخصصي لطب وتجميل الأسنان';
  return [
    `إيصال دفع من ${clinicName}`,
    '',
    `رقم الإيصال: ${id}`,
    `التاريخ: ${formatReceiptDate(date)}`,
    `اسم المريض: ${patient?.displayName || patient?.name || '-'}`,
    `رقم الهاتف: ${patient?.phone || '-'}`,
    `الخدمة: ${serviceName || '-'}`,
    doctorName ? `الطبيب: د. ${doctorName}` : null,
    `طريقة الدفع: ${method || '-'}`,
    '',
    `الإجمالي: ${money(amount)}`,
    `المدفوع: ${money(paidAmount)}`,
    `المتبقي: ${money(remainingAmount)}`,
    '',
    'شكراً لتعاملكم معنا.',
  ]
    .filter(Boolean)
    .join('\n');
};

const sendReceipt = async (req, res, next) => {
  try {
    const { id, source = 'payment' } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Payment ID is required' });

    let receipt;

    if (source === 'extra') {
      const extra = await prisma.extraCharge.findUnique({
        where: { id },
        include: { patient: true, service: true, doctor: true },
      });
      if (!extra) return res.status(404).json({ error: 'Payment not found' });
      const amount = toNumber(extra.amount);
      const paidAmount = toNumber(extra.paidAmount);
      receipt = {
        id: extra.id,
        patient: extra.patient,
        serviceName: extra.service?.nameAr || extra.service?.name || extra.description || 'خدمة إضافية',
        doctorName: extra.doctor?.name || '',
        amount,
        paidAmount,
        remainingAmount: Math.max(0, amount - paidAmount),
        method: extra.method,
        date: extra.createdAt,
      };
    } else {
      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          patient: true,
          service: true,
          appointment: { include: { patient: true, doctor: true, service: true } },
        },
      });
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      const amount = toNumber(payment.finalAmount);
      const paidAmount = toNumber(payment.paidAmount);
      receipt = {
        id: payment.id,
        patient: payment.patient || payment.appointment?.patient,
        serviceName:
          payment.service?.nameAr ||
          payment.service?.name ||
          payment.appointment?.service?.nameAr ||
          payment.appointment?.service?.name ||
          'خدمة علاجية',
        doctorName: payment.appointment?.doctor?.name || '',
        amount,
        paidAmount,
        remainingAmount: Math.max(0, amount - paidAmount),
        method: payment.method,
        date: payment.paidAt || payment.createdAt,
      };
    }

    if (!receipt.patient?.phone) {
      return res.status(400).json({ error: 'لا يوجد رقم واتساب لهذا المريض' });
    }

    const message = buildReceiptMessage(receipt);
    await whatsappService.sendTextMessage(receipt.patient.phone, message);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

const listExtraCharges = async (req, res, next) => {
  try {
    const { patientId } = req.query;
    const where = patientId ? { patientId } : {};
    const items = await prisma.extraCharge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { service: true, doctor: true },
    });
    res.json({ extraCharges: items });
  } catch (error) {
    next(error);
  }
};

const createExtraCharge = async (req, res, next) => {
  try {
    const { patientId, serviceId, doctorId, description, amount, paidAmount = 0, teethCount = 1, method, notes } = req.body;
    if (!patientId) return res.status(400).json({ error: 'المريض مطلوب' });
    if (!serviceId && !String(description || '').trim()) {
      return res.status(400).json({ error: 'اختر خدمة أو اكتب وصفاً' });
    }
    const amountNum = toNumber(amount);
    if (!(amountNum > 0)) return res.status(400).json({ error: 'المبلغ غير صالح' });
    const paidNum = Math.max(0, toNumber(paidAmount));
    const teethCountNum = Math.max(1, Math.floor(toNumber(teethCount) || 1));

    const extraCharge = await prisma.extraCharge.create({
      data: {
        patientId,
        serviceId: serviceId || null,
        doctorId: doctorId || null,
        description: description ? String(description).trim() : null,
        amount: amountNum,
        paidAmount: paidNum,
        teethCount: teethCountNum,
        status: extraStatus(paidNum, amountNum),
        method: method || null,
        notes: notes || null,
        createdById: req.user?.id || null,
      },
      include: { service: true, doctor: true },
    });
    res.status(201).json({ extraCharge });
  } catch (error) {
    next(error);
  }
};

const updateExtraCharge = async (req, res, next) => {
  try {
    const existing = await prisma.extraCharge.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'البند غير موجود' });

    const amountNum = req.body.amount !== undefined ? toNumber(req.body.amount) : existing.amount;
    const paidNum =
      req.body.paidAmount !== undefined ? Math.max(0, toNumber(req.body.paidAmount)) : existing.paidAmount;
    const teethCountNum =
      req.body.teethCount !== undefined
        ? Math.max(1, Math.floor(toNumber(req.body.teethCount) || 1))
        : existing.teethCount;

    const extraCharge = await prisma.extraCharge.update({
      where: { id: req.params.id },
      data: {
        amount: amountNum,
        paidAmount: paidNum,
        teethCount: teethCountNum,
        status: extraStatus(paidNum, amountNum),
        method: req.body.method ?? existing.method,
        notes: req.body.notes ?? existing.notes,
        ...(req.body.serviceId !== undefined && { serviceId: req.body.serviceId || null }),
        ...(req.body.doctorId !== undefined && { doctorId: req.body.doctorId || null }),
        ...(req.body.description !== undefined && {
          description: req.body.description ? String(req.body.description).trim() : null,
        }),
      },
      include: { service: true, doctor: true },
    });
    res.json({ extraCharge });
  } catch (error) {
    next(error);
  }
};

const deleteExtraCharge = async (req, res, next) => {
  try {
    const existing = await prisma.extraCharge.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'البند غير موجود' });
    await prisma.extraCharge.delete({ where: { id: req.params.id } });
    res.json({ success: true });
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
      teethCount: req.body.teethCount ?? existing.teethCount,
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

module.exports = {
  list,
  revenueReport,
  upsertByAppointment,
  update,
  listExtraCharges,
  createExtraCharge,
  updateExtraCharge,
  deleteExtraCharge,
  sendReceipt,
};
