const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputDir = path.join(__dirname, '../../public/documents');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const candidateFonts = [
  process.env.PRESCRIPTION_PDF_FONT_PATH,
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
  '/usr/share/fonts/opentype/noto/NotoNaskhArabic-Regular.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
  'C:\\Windows\\Fonts\\Tahoma.ttf',
].filter(Boolean);

const findAvailableFont = () => candidateFonts.find((fontPath) => fs.existsSync(fontPath)) || null;

const sanitizeFilePart = (value, fallback = 'file') =>
  String(value || fallback)
    .trim()
    .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
    .replace(/^_+|_+$/g, '') || fallback;

const addLabelValue = (doc, label, value) => {
  doc.fontSize(12).fillColor('#0f172a').text(`${label}: ${value || 'غير متوفر'}`, {
    align: 'right',
  });
  doc.moveDown(0.5);
};

const createPrescriptionPdf = async ({ prescription, clinicName = 'العيادة' }) => {
  const patientName = prescription.patient?.name || 'patient';
  const filename = `${Date.now()}-${sanitizeFilePart(patientName, 'patient')}-prescription.pdf`;
  const filePath = path.join(outputDir, filename);
  const relativeUrl = `/api/documents/${filename}`;

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Prescription - ${patientName}`,
      Author: clinicName,
      Subject: 'Medical Prescription',
    },
  });

  const fontPath = findAvailableFont();
  if (fontPath) {
    doc.registerFont('ClinicFont', fontPath);
    doc.font('ClinicFont');
  }

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).fillColor('#0f172a').text('روشتة طبية إلكترونية', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#475569').text(clinicName, { align: 'center' });
    doc.moveDown(1.5);

    addLabelValue(doc, 'اسم المريض', prescription.patient?.name);
    addLabelValue(doc, 'الطبيب', prescription.doctor?.name);
    addLabelValue(doc, 'تاريخ الكشف', prescription.formattedDate || '');
    addLabelValue(doc, 'التشخيص', prescription.diagnosis);

    doc.moveDown(0.5);
    doc.fontSize(14).fillColor('#0f172a').text('الأدوية', { align: 'right' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#0f172a').text(prescription.formattedMedications || 'لا توجد أدوية مسجلة', {
      align: 'right',
    });

    doc.moveDown(1);
    addLabelValue(doc, 'ملاحظات', prescription.notes || 'لا يوجد');

    doc.moveDown(1.5);
    doc.fontSize(10).fillColor('#64748b').text('مع تمنياتنا لك بالشفاء العاجل', { align: 'center' });
    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { filePath, relativeUrl, filename };
};

module.exports = {
  createPrescriptionPdf,
};
