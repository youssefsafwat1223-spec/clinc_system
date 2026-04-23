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

const FONT_BOLD_CANDIDATES = [
  path.join(__dirname, '../../assets/fonts/Cairo-Bold.ttf'),
  path.join(__dirname, '../../assets/fonts/NotoNaskhArabic-Bold.ttf'),
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf',
  'C:\\Windows\\Fonts\\arialbd.ttf',
  'C:\\Windows\\Fonts\\tahomabd.ttf',
];

const C = {
  teal:       '#0D9488',
  tealDark:   '#0F766E',
  tealLight:  '#CCFBF1',
  tealMid:    '#5EEAD4',
  navy:       '#0F172A',
  text:       '#1E293B',
  muted:      '#64748B',
  lightMuted: '#94A3B8',
  border:     '#E2E8F0',
  panelBg:    '#F8FAFC',
  white:      '#FFFFFF',
  pillBg:     '#F0FDFA',
  accent:     '#14B8A6',
};

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const resolveFont = (candidates) => {
  for (const candidate of candidates) {
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

/* ─── helpers ─── */
const pageW = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const leftX = (doc) => doc.page.margins.left;

const useBold = (doc) => { if (doc._hasBold) doc.font('Bold'); };
const useRegular = (doc) => { doc.font('Regular'); };

/* ─── header ─── */
const addHeader = (doc, clinicName) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const y = doc.page.margins.top;
  const h = 100;

  // teal gradient band
  doc.save();
  doc.rect(x, y, w, h).fill(C.teal);
  doc.rect(x, y + h - 6, w, 6).fill(C.tealDark);
  doc.restore();

  // Rx symbol
  doc.fillColor(C.white).opacity(0.15).fontSize(64).text('℞', x + 24, y + 14, { width: 80 });
  doc.opacity(1);

  // title
  useBold(doc);
  doc.fillColor(C.white).fontSize(26).text('روشتة طبية إلكترونية', x + 20, y + 20, {
    width: w - 40,
    align: 'right',
  });

  // clinic name
  useRegular(doc);
  doc.fillColor(C.tealLight).fontSize(13).text(clinicName || 'العيادة', x + 20, y + 58, {
    width: w - 40,
    align: 'right',
  });

  doc.y = y + h + 20;
};

/* ─── section title ─── */
const drawSectionTitle = (doc, title, icon) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const sy = doc.y;

  // left accent bar
  doc.save();
  doc.roundedRect(x, sy, 4, 22, 2).fill(C.accent);
  doc.restore();

  // background pill
  doc.save();
  doc.roundedRect(x + 10, sy, w - 10, 22, 4).fill(C.pillBg);
  doc.restore();

  // text
  useBold(doc);
  const label = icon ? `${icon}  ${title}` : title;
  doc.fillColor(C.tealDark).fontSize(12).text(label, x + 18, sy + 5, {
    width: w - 36,
    align: 'right',
  });
  useRegular(doc);

  doc.y = sy + 30;
};

/* ─── key:value row ─── */
const writeKeyValue = (doc, label, value) => {
  const x = leftX(doc);
  const w = pageW(doc);

  useBold(doc);
  doc.fillColor(C.muted).fontSize(10).text(label, x + 20, doc.y, {
    width: w - 40,
    align: 'right',
    continued: true,
  });
  useRegular(doc);
  doc.fillColor(C.text).fontSize(11).text(`:  ${value || 'غير متوفر'}`, {
    align: 'right',
    lineGap: 3,
  });
};

/* ─── info card (patient / doctor side-by-side) ─── */
const drawInfoCards = (doc, prescription) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const cardH = 70;
  const gap = 12;
  const halfW = (w - gap) / 2;
  const sy = doc.y;

  // patient card
  doc.save();
  doc.roundedRect(x + halfW + gap, sy, halfW, cardH, 8).fill(C.panelBg);
  doc.roundedRect(x + halfW + gap, sy, halfW, cardH, 8).lineWidth(0.5).stroke(C.border);
  doc.restore();

  useBold(doc);
  doc.fillColor(C.tealDark).fontSize(10).text('بيانات المريض', x + halfW + gap + 12, sy + 10, { width: halfW - 24, align: 'right' });
  useRegular(doc);
  doc.fillColor(C.text).fontSize(11).text(prescription?.patient?.name || 'غير متوفر', x + halfW + gap + 12, sy + 28, { width: halfW - 24, align: 'right' });
  doc.fillColor(C.muted).fontSize(9).text(prescription?.patient?.phone || '', x + halfW + gap + 12, sy + 46, { width: halfW - 24, align: 'right' });

  // doctor card
  doc.save();
  doc.roundedRect(x, sy, halfW, cardH, 8).fill(C.panelBg);
  doc.roundedRect(x, sy, halfW, cardH, 8).lineWidth(0.5).stroke(C.border);
  doc.restore();

  useBold(doc);
  doc.fillColor(C.tealDark).fontSize(10).text('الطبيب المعالج', x + 12, sy + 10, { width: halfW - 24, align: 'right' });
  useRegular(doc);
  doc.fillColor(C.text).fontSize(11).text(prescription?.doctor?.name || 'غير محدد', x + 12, sy + 28, { width: halfW - 24, align: 'right' });
  doc.fillColor(C.muted).fontSize(9).text(prescription?.formattedDate || '', x + 12, sy + 46, { width: halfW - 24, align: 'right' });

  doc.y = sy + cardH + 16;
};

/* ─── medication rows ─── */
const drawMedications = (doc, lines) => {
  const x = leftX(doc);
  const w = pageW(doc);

  lines.forEach((line, i) => {
    const rowY = doc.y;
    const isEven = i % 2 === 0;

    // alternate row bg
    if (isEven) {
      doc.save();
      doc.rect(x + 8, rowY - 2, w - 16, 20).fill(C.panelBg);
      doc.restore();
    }

    // bullet
    doc.save();
    doc.circle(x + w - 22, rowY + 6, 3).fill(C.accent);
    doc.restore();

    doc.fillColor(C.text).fontSize(11).text(line, x + 20, rowY, {
      width: w - 52,
      align: 'right',
      lineGap: 5,
    });

    doc.y = doc.y + 4;
  });
};

/* ─── divider ─── */
const drawDivider = (doc) => {
  const x = leftX(doc);
  const w = pageW(doc);
  doc.save();
  doc.moveTo(x + 30, doc.y).lineTo(x + w - 30, doc.y).lineWidth(0.4).dash(3, { space: 3 }).stroke(C.border);
  doc.restore();
  doc.y += 10;
};

/* ─── footer ─── */
const addFooter = (doc) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const footerY = doc.page.height - doc.page.margins.bottom - 44;

  // teal strip
  doc.save();
  doc.rect(x, footerY, w, 36).fill(C.teal);
  doc.restore();

  doc.fillColor(C.white).fontSize(9).text(
    'هذه الروشتة صادرة إلكترونيًا من نظام إدارة العيادة الذكي  •  لا يُعتدّ بها بدون توقيع الطبيب',
    x + 16,
    footerY + 12,
    { width: w - 32, align: 'center' }
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════════════════════ */
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

  // register fonts
  const fontRegular = resolveFont(FONT_CANDIDATES);
  const fontBold = resolveFont(FONT_BOLD_CANDIDATES);

  if (fontRegular) {
    doc.registerFont('Regular', fontRegular);
    doc.font('Regular');
  }

  if (fontBold) {
    doc.registerFont('Bold', fontBold);
    doc._hasBold = true;
  } else if (fontRegular) {
    // fallback: use regular for both
    doc.registerFont('Bold', fontRegular);
    doc._hasBold = true;
  }

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  /* ── layout ── */
  addHeader(doc, clinicName);

  drawInfoCards(doc, prescription);

  drawDivider(doc);

  drawSectionTitle(doc, 'التشخيص');
  doc.fillColor(C.text).fontSize(12).text(prescription?.diagnosis || 'لا يوجد تشخيص مسجل', {
    align: 'right',
    lineGap: 5,
    indent: 20,
  });
  doc.moveDown(0.8);

  drawSectionTitle(doc, 'الأدوية والتعليمات');
  const medicationLines = normalizeMedicationLines(prescription);
  drawMedications(doc, medicationLines);
  doc.moveDown(0.6);

  if (prescription?.notes) {
    drawDivider(doc);
    drawSectionTitle(doc, 'ملاحظات الطبيب');
    doc.fillColor(C.muted).fontSize(11).text(prescription.notes, {
      align: 'right',
      lineGap: 5,
      indent: 20,
    });
  }

  addFooter(doc);

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
