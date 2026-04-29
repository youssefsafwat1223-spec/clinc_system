const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');
const { formatDateAr } = require('../utils/helpers');
const config = require('../config/env');
const { createPrescriptionPdf } = require('../utils/prescriptionPdf');

const CARE_WINDOW_HOURS = 24;
const PRESCRIPTION_TEMPLATE = 'prescription_ready_ar_v1';

const toAbsoluteUrl = (req, url) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;

  const baseUrl = (config.dashboardUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return new URL(url, `${baseUrl}/`).toString();
};

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

const normalizeMedications = (medications, medicines) => {
  if (Array.isArray(medications)) {
    return medications.filter(Boolean);
  }

  if (Array.isArray(medicines)) {
    return medicines.filter(Boolean);
  }

  const textValue =
    typeof medications === 'string' && medications.trim()
      ? medications
      : typeof medicines === 'string' && medicines.trim()
        ? medicines
        : '';

  if (!textValue) {
    return [];
  }

  return textValue
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const formatMedications = (medications) => {
  if (typeof medications === 'string') {
    return medications.trim() || 'لا توجد أدوية مسجلة';
  }

  if (!Array.isArray(medications) || medications.length === 0) {
    return 'لا توجد أدوية مسجلة';
  }

  return medications
    .map((medication, index) => {
      if (typeof medication === 'string') {
        return `${index + 1}. ${medication}`;
      }

      if (!medication || typeof medication !== 'object') {
        return null;
      }

      const name = medication.name || `دواء ${index + 1}`;
      const details = [
        medication.dosage ? `الجرعة: ${medication.dosage}` : null,
        medication.duration ? `المدة: ${medication.duration}` : null,
      ].filter(Boolean);

      if (details.length === 0) {
        return `${index + 1}. *${name}*`;
      }

      return `${index + 1}. *${name}*\n   ${details.join('\n   ')}`;
    })
    .filter(Boolean)
    .join('\n');
};

const isWithinWhatsAppCareWindow = async (patientId) => {
  if (!patientId) {
    return false;
  }

  const since = new Date(Date.now() - CARE_WINDOW_HOURS * 60 * 60 * 1000);
  const inboundMessage = await prisma.message.findFirst({
    where: {
      patientId,
      platform: 'WHATSAPP',
      type: 'INBOUND',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  return Boolean(inboundMessage);
};

const buildPrescriptionText = (prescription) => {
  const medicationsText = formatMedications(prescription.medications);

  return [
    '💊 *روشتة طبية إلكترونية*',
    '',
    `العيادة: د. ${prescription.doctor?.name || 'غير محدد'}`,
    `تاريخ الكشف: ${formatDateAr(prescription.createdAt)}`,
    '',
    `التشخيص: ${prescription.diagnosis || 'غير مسجل'}`,
    '',
    `الأدوية:\n${medicationsText}`,
    '',
    `ملاحظات: ${prescription.notes || 'لا يوجد'}`,
    '',
    'مع تمنياتنا لك بالشفاء العاجل! 🙏',
  ].join('\n');
};

const getAccessiblePatient = async (req, patientId) => {
  const scopedDoctor = await getScopedDoctor(req);

  if (!scopedDoctor) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, name: true, phone: true },
    });

    return { patient, scopedDoctor: null };
  }

  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      ...buildDoctorPatientAccessWhere(scopedDoctor.id),
    },
    select: { id: true, name: true, phone: true },
  });

  return { patient, scopedDoctor };
};

const resolveFallbackDoctorIdForPatient = async (patientId) => {
  const latestAppointment = await prisma.appointment.findFirst({
    where: {
      patientId,
      doctorId: { not: null },
    },
    orderBy: { scheduledTime: 'desc' },
    select: { doctorId: true },
  });

  if (latestAppointment?.doctorId) {
    return latestAppointment.doctorId;
  }

  const firstActiveDoctor = await prisma.doctor.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  return firstActiveDoctor?.id || null;
};

const getAccessiblePrescription = async (req, prescriptionId) => {
  const scopedDoctor = await getScopedDoctor(req);

  const prescription = await prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      ...(scopedDoctor ? { doctorId: scopedDoctor.id } : {}),
    },
    include: { patient: true, doctor: true },
  });

  return { prescription, scopedDoctor };
};

const getAll = async (req, res, next) => {
  try {
    const { patientId } = req.query;
    const scopedDoctor = await getScopedDoctor(req);

    const where = {
      ...(patientId ? { patientId } : {}),
      ...(scopedDoctor ? { doctorId: scopedDoctor.id } : {}),
    };

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        doctor: { select: { name: true, specialization: true } },
        patient: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ prescriptions });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { patientId, doctorId, diagnosis, medications, medicines, notes } = req.body;

    if (!patientId || !diagnosis?.trim()) {
      return res.status(400).json({ error: 'المريض والتشخيص مطلوبان' });
    }

    const normalizedMedications = normalizeMedications(medications, medicines);
    if (normalizedMedications.length === 0) {
      return res.status(400).json({ error: 'الأدوية مطلوبة' });
    }

    const { patient, scopedDoctor } = await getAccessiblePatient(req, patientId);
    if (!patient) {
      return res.status(404).json({ error: 'المريض غير موجود' });
    }

    let resolvedDoctorId = scopedDoctor?.id || doctorId;
    if (!resolvedDoctorId) {
      resolvedDoctorId = await resolveFallbackDoctorIdForPatient(patient.id);
    }

    if (!resolvedDoctorId) {
      return res.status(400).json({ error: 'الطبيب مطلوب لإنشاء الروشتة' });
    }

    if (!scopedDoctor) {
      const doctor = await prisma.doctor.findUnique({
        where: { id: resolvedDoctorId },
        select: { id: true },
      });

      if (!doctor) {
        return res.status(404).json({ error: 'الطبيب غير موجود' });
      }
    }

    const prescription = await prisma.prescription.create({
      data: {
        patientId: patient.id,
        doctorId: resolvedDoctorId,
        diagnosis: diagnosis.trim(),
        medications: normalizedMedications,
        ...(notes !== undefined && { notes }),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    res.status(201).json({ prescription });
  } catch (error) {
    next(error);
  }
};

const sendToWhatsApp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { prescription } = await getAccessiblePrescription(req, id);

    if (!prescription) {
      return res.status(404).json({ error: 'الروشتة غير موجودة' });
    }

    if (!prescription.patient?.phone) {
      return res.status(400).json({ error: 'رقم هاتف المريض غير متوفر' });
    }

    const msg = buildPrescriptionText(prescription);
    const withinWindow = await isWithinWhatsAppCareWindow(prescription.patient.id);

    const pdfPayload = {
      ...prescription,
      formattedDate: formatDateAr(prescription.createdAt),
      formattedMedications: formatMedications(prescription.medications),
    };

    const settings = await prisma.clinicSettings.findFirst();

    const { relativeUrl, filename } = await createPrescriptionPdf({
      prescription: pdfPayload,
      clinicName: settings?.clinicNameAr || settings?.clinicName || 'العيادة',
      brand: {
        logoUrl: settings?.brandLogoUrl ? toAbsoluteUrl(req, settings.brandLogoUrl) : null,
        primaryColor: settings?.brandPrimaryColor,
        secondaryColor: settings?.brandSecondaryColor,
        footer: settings?.prescriptionFooter,
      },
    });
    const documentUrl = toAbsoluteUrl(req, relativeUrl);

    if (withinWindow) {
      await whatsappService.sendDocumentMessage(
        prescription.patient.phone,
        documentUrl,
        filename,
        'روشتة طبية'
      );
      await whatsappService.sendTextMessage(prescription.patient.phone, msg);
    } else {
      await whatsappService.sendTemplateMessage(
        prescription.patient.phone,
        PRESCRIPTION_TEMPLATE,
        'ar',
        null,
        [],
        { type: 'document', link: documentUrl, filename }
      );
    }

    res.json({ success: true, message: 'تم إرسال الروشتة للمريض' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAll, create, sendToWhatsApp };
