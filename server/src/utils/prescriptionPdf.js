const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const DOCUMENTS_DIR = path.join(__dirname, '../../public/documents');

const FONT_CANDIDATES = [
  path.join(__dirname, '../../assets/fonts/Cairo-Regular.ttf'),
  path.join(__dirname, '../../assets/fonts/NotoNaskhArabic-Regular.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf',
  'C:\\Windows\\Fonts\\arial.ttf',
  'C:\\Windows\\Fonts\\tahoma.ttf',
];

const COLOR = {
  primary: '#0B74D1',
  primaryDark: '#074F8F',
  text: '#0F172A',
  muted: '#475569',
  border: '#D7E3F2',
  panel: '#F8FBFF',
  white: '#FFFFFF',
};

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const resolveFontPath = () => {
  for (const candidate of FONT_CANDIDATES) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const toSafeFilenamePart = (value) => String(value || 'rx').replace(/[^\w-]+/g, '_');

const normalizeMedicationLines = (prescription) => {
  if (typeof prescription.formattedMedications === 'string' && prescription.formattedMedications.trim()) {
    return prescription.formattedMedications
      .split(/\r?\n/)
      .map((line) => line.replace(/\*/g, '').trim())
      .filter(Boolean);
  }

  if (Array.isArray(prescription.medications)) {
    return prescription.medications
      .map((item, index) => {
        if (!item) return null;
        if (typeof item === 'string') return `${index + 1}. ${item}`;
        if (typeof item !== 'object') return null;

        const name = item.name || `دواء ${index + 1}`;
        const dosage = item.dosage ? ` | الجرعة: ${item.dosage}` : '';
        const duration = item.duration ? ` | المدة: ${item.duration}` : '';
        return `${index + 1}. ${name}${dosage}${duration}`;
      })
      .filter(Boolean);
  }

  return ['لا توجد أدوية مسجلة'];
};

const addHeader = (doc, clinicName) => {
  const x = doc.page.margins.left;
  const y = doc.page.margins.top;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = 88;

  doc.save();
  doc.rect(x, y, width, height).fill(COLOR.primary);
  doc.rect(x, y + height - 22, width, 22).fill(COLOR.primaryDark);
  doc.restore();

  doc.fillColor(COLOR.white).fontSize(24).text('روشتة طبية', x + 20, y + 16, {
    width: width - 40,
    align: 'right',
  });

  doc.fillColor(COLOR.white).fontSize(12).text(clinicName || 'العيادة', x + 20, y + 55, {
    width: width - 40,
    align: 'right',
  });

  doc.moveDown(2.4);
};

const drawSectionTitle = (doc, title) => {
  const x = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.save();
  doc.roundedRect(x, doc.y, width, 24, 6).fill(COLOR.panel).stroke(COLOR.border);
  doc.restore();

  doc.fillColor(COLOR.primaryDark).fontSize(12).text(title, x + 12, doc.y - 18, {
    width: width - 24,
    align: 'right',
  });
  doc.moveDown(0.55);
};

const writeKeyValue = (doc, label, value) => {
  doc.fillColor(COLOR.text).fontSize(11).text(`${label}: ${value || 'غير متوفر'}`, {
    align: 'right',
    lineGap: 4,
  });
};

const createPrescriptionPdf = async ({ prescription, clinicName }) => {
  await ensureDir(DOCUMENTS_DIR);

  const timestamp = Date.now();
  const suffix = toSafeFilenamePart((prescription?.id || '').slice(-8) || timestamp);
  const filename = `prescription-${suffix}.pdf`;
  const filePath = path.join(DOCUMENTS_DIR, filename);
  const relativeUrl = `/api/documents/${filename}`;

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 36, right: 36, bottom: 36, left: 36 },
    info: {
      Title: `Prescription ${prescription?.id || ''}`.trim(),
      Author: clinicName || 'Clinic',
      Subject: 'Medical Prescription',
      Creator: 'Clinic Management System',
    },
  });

  const fontPath = resolveFontPath();
  if (fontPath) {
    doc.font(fontPath);
  }

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  addHeader(doc, clinicName);

  drawSectionTitle(doc, 'بيانات المريض');
  writeKeyValue(doc, 'الاسم', prescription?.patient?.name || prescription?.patientName || 'غير متوفر');
  writeKeyValue(doc, 'الهاتف', prescription?.patient?.phone || 'غير متوفر');
  doc.moveDown(0.8);

  drawSectionTitle(doc, 'بيانات الطبيب والزيارة');
  writeKeyValue(doc, 'الطبيب', prescription?.doctor?.name || 'غير محدد');
  writeKeyValue(doc, 'تاريخ الإصدار', prescription?.formattedDate || 'غير متوفر');
  doc.moveDown(0.8);

  drawSectionTitle(doc, 'التشخيص');
  doc.fillColor(COLOR.text).fontSize(12).text(prescription?.diagnosis || 'لا يوجد تشخيص مسجل', {
    align: 'right',
    lineGap: 5,
  });
  doc.moveDown(0.9);

  drawSectionTitle(doc, 'الأدوية والتعليمات');
  const medicationLines = normalizeMedicationLines(prescription);
  medicationLines.forEach((line) => {
    doc.fillColor(COLOR.text).fontSize(11).text(`• ${line}`, {
      align: 'right',
      lineGap: 4,
    });
  });
  doc.moveDown(0.9);

  drawSectionTitle(doc, 'ملاحظات إضافية');
  doc.fillColor(COLOR.muted).fontSize(11).text(prescription?.notes || 'لا توجد ملاحظات.', {
    align: 'right',
    lineGap: 5,
  });

  const footerY = doc.page.height - doc.page.margins.bottom - 52;
  doc.save();
  doc.rect(doc.page.margins.left, footerY, doc.page.width - doc.page.margins.left - doc.page.margins.right, 40)
    .fill(COLOR.panel)
    .stroke(COLOR.border);
  doc.restore();

  doc.fillColor(COLOR.primaryDark).fontSize(10).text('هذه الروشتة صادرة إلكترونيًا من نظام العيادة.', doc.page.margins.left + 10, footerY + 13, {
    width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 20,
    align: 'right',
  });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { filePath, relativeUrl, filename };
};

module.exports = {
  createPrescriptionPdf,
};
