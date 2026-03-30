const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');

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
            OR: [{ doctorId: scopedDoctor.id }, { doctorId: null }, { status: 'PENDING' }],
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

    await whatsappService.sendTextMessage(consultation.patient.phone, messageBody);

    res.json(consultation);
  } catch (error) {
    next(error);
  }
};

exports.close = async (req, res, next) => {
  try {
    const { id } = req.params;
    const consultation = await prisma.consultation.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
    res.json(consultation);
  } catch (error) {
    next(error);
  }
};
