const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');
const messengerService = require('../services/messengerService');
const instagramService = require('../services/instagramService');

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

exports.getAll = async (req, res, next) => {
  try {
    const scopedDoctor = await getScopedDoctor(req);
    const consultations = await prisma.consultation.findMany({
      where: scopedDoctor
        ? {
            OR: [{ doctorId: scopedDoctor.id }, { doctorId: null }],
          }
        : undefined,
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(consultations);
  } catch (error) {
    next(error);
  }
};

exports.reply = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reply, doctorId, requestAppointment } = req.body;
    const scopedDoctor = await getScopedDoctor(req);
    const existing = await prisma.consultation.findUnique({
      where: { id },
      select: { id: true, doctorId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'الاستشارة غير موجودة' });
    }

    if (scopedDoctor && existing.doctorId && existing.doctorId !== scopedDoctor.id) {
      return res.status(403).json({ error: 'لا يمكنك الرد على استشارة لطبيب آخر' });
    }

    const resolvedDoctorId = scopedDoctor?.id || doctorId || undefined;

    const consultation = await prisma.consultation.update({
      where: { id },
      data: {
        reply,
        ...(resolvedDoctorId && { doctorId: resolvedDoctorId }),
        status: 'REPLIED',
        updatedAt: new Date(),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    // Send reply to patient via WhatsApp
    let messageBody = `👨‍⚕️ *رد من ${consultation.doctor?.name || 'الطبيب'} على استشارتك:*\n\n"${reply}"`;
    
    if (requestAppointment) {
      messageBody += `\n\nبناءً على التقييم، يُرجى حجز موعد للكشف في العيادة لمتابعة الحالة بدقة أعلى. يمكنك الحجز من القائمة الرئيسية.`;
    }

    if (consultation.patient.platform === 'FACEBOOK') {
      await messengerService.sendTextMessage(consultation.patient.facebookId || consultation.patient.phone, messageBody);
    } else if (consultation.patient.platform === 'INSTAGRAM') {
      await instagramService.sendTextMessage(consultation.patient.instagramId || consultation.patient.phone, messageBody);
    } else {
      await whatsappService.sendTextMessage(consultation.patient.phone, messageBody);
    }

    res.json(consultation);
  } catch (error) {
    next(error);
  }
};

exports.close = async (req, res, next) => {
  try {
    const { id } = req.params;
    const scopedDoctor = await getScopedDoctor(req);
    const existing = await prisma.consultation.findUnique({
      where: { id },
      select: { id: true, doctorId: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'الاستشارة غير موجودة' });
    }

    if (scopedDoctor && existing.doctorId && existing.doctorId !== scopedDoctor.id) {
      return res.status(403).json({ error: 'لا يمكنك إغلاق استشارة لطبيب آخر' });
    }

    const consultation = await prisma.consultation.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    res.json(consultation);
  } catch (error) {
    next(error);
  }
};
