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

/* ─── Color palette ─── */
const C = {
  navy: '#0B1929',
  navyMid: '#162840',
  gold: '#C9A84C',
  goldLight: '#E8C97A',
  goldPale: '#FDF6E3',
  cream: '#FAFAF7',
  ink: '#1A1A2E',
  inkMid: '#3D3D5C',
  inkMuted: '#7A7A9A',
  border: '#E8E8F0',
  teal: '#0D7E75',
  tealLight: '#E6F5F4',
  white: '#FFFFFF',
};

/* ─── Helpers ─── */
const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const resolveFont = (candidates) => {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const toSafeFilenamePart = (value) =>
  String(value || 'rx').replace(/[^\w-]+/g, '_');

const normalizeMedicationLines = (prescription) => {
  if (
    typeof prescription.formattedMedications === 'string' &&
    prescription.formattedMedications.trim()
  ) {
    return prescription.formattedMedications
      .split(/\r?\n/)
      .map((line) => line.replace(/\*/g, '').trim())
      .filter(Boolean);
  }

  if (Array.isArray(prescription.medications)) {
    return prescription.medications
      .map((item, index) => {
        if (!item) return null;
        if (typeof item === 'string') return { name: item, detail: null };
        if (typeof item !== 'object') return null;

        const name = item.name || `دواء ${index + 1}`;
        const parts = [];
        if (item.dosage) parts.push(`الجرعة: ${item.dosage}`);
        if (item.duration) parts.push(`المدة: ${item.duration}`);
        return { name, detail: parts.join(' · ') || null };
      })
      .filter(Boolean);
  }

  return [{ name: 'لا توجد أدوية مسجلة', detail: null }];
};

/* convenience wrappers */
const pageW = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const leftX = (doc) => doc.page.margins.left;
const useBold = (doc) => { if (doc._hasBold) doc.font('Bold'); };
const useRegular = (doc) => { doc.font('Regular'); };

/* ─────────────────────────────────────────────
   HEADER  (navy two-band)
───────────────────────────────────────────── */
const addHeader = (doc, clinicName, prescription) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const mt = doc.page.margins.top;

  /* ── top band ── */
  const band1H = 80;
  doc.rect(x, mt, w, band1H).fill(C.navy);

  /* gold shimmer line at bottom of top band */
  doc.save();
  doc.rect(x, mt + band1H - 2, w, 2).fill(C.gold);
  doc.restore();

  /* clinic name – right aligned */
  useBold(doc);
  doc
    .fillColor(C.white)
    .fontSize(18)
    .text(clinicName || 'العيادة', x + 16, mt + 16, {
      width: w - 32,
      align: 'right',
    });

  useRegular(doc);
  doc
    .fillColor('rgba(255,255,255,0.45)')
    .fontSize(10)
    .text('نظام إدارة العيادة الذكي', x + 16, mt + 44, {
      width: w - 32,
      align: 'right',
    });

  /* RX id – left side */
  doc
    .fillColor('rgba(201,168,76,0.7)')
    .fontSize(9)
    .text(`RX-${(prescription?.id || '').slice(-8).toUpperCase() || 'N/A'}`, x + 16, mt + 20, {
      width: 160,
      align: 'left',
    });

  doc
    .fillColor('rgba(255,255,255,0.25)')
    .fontSize(8)
    .text('VERIFIED PRESCRIPTION', x + 16, mt + 36, {
      width: 160,
      align: 'left',
    });

  /* ── second band (navy-mid) ── */
  const band2Y = mt + band1H;
  const band2H = 36;
  doc.rect(x, band2Y, w, band2H).fill(C.navyMid);

  /* "روشتة طبية" title – right */
  useBold(doc);
  doc
    .fillColor(C.white)
    .fontSize(20)
    .text('روشتة طبية', x + 16, band2Y + 8, {
      width: w - 32,
      align: 'right',
    });

  /* meta pills: date / age / gender – left */
  const pillData = [
    { label: 'التاريخ', value: prescription?.formattedDate || '—' },
    { label: 'العمر', value: prescription?.patient?.age ? `${prescription.patient.age} سنة` : '—' },
    { label: 'النوع', value: prescription?.patient?.gender || '—' },
  ];

  useRegular(doc);
  let pillX = x + 16;
  pillData.forEach(({ label, value }) => {
    const pw = 80;
    doc.roundedRect(pillX, band2Y + 7, pw, 22, 4).fill('rgba(255,255,255,0.08)');

    doc.fillColor('rgba(255,255,255,0.4)').fontSize(7)
      .text(label, pillX + 4, band2Y + 9, { width: pw - 8, align: 'center' });

    doc.fillColor(C.goldLight).fontSize(9)
      .text(value, pillX + 4, band2Y + 19, { width: pw - 8, align: 'center' });

    pillX += pw + 6;
  });

  doc.y = band2Y + band2H + 20;
};

/* ─────────────────────────────────────────────
   INFO CARDS  (patient | doctor side-by-side)
───────────────────────────────────────────── */
const drawInfoCards = (doc, prescription) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const gap = 14;
  const hw = (w - gap) / 2;
  const sy = doc.y;
  const h = 72;
  const r = 10;

  const cards = [
    {
      xPos: x + hw + gap,
      accent: C.teal,
      type: 'بيانات المريض',
      name: prescription?.patient?.name || 'غير متوفر',
      detail: prescription?.patient?.phone || '',
    },
    {
      xPos: x,
      accent: C.gold,
      type: 'الطبيب المعالج',
      name: prescription?.doctor?.name || 'غير محدد',
      detail: prescription?.doctor?.specialty || '',
    },
  ];

  cards.forEach(({ xPos, accent, type, name, detail }) => {
    /* card bg */
    doc.roundedRect(xPos, sy, hw, h, r).fill(C.cream);
    doc.roundedRect(xPos, sy, hw, h, r).lineWidth(0.5).stroke(C.border);

    /* right accent bar */
    doc.roundedRect(xPos + hw - 4, sy + r, 4, h - r * 2, 2).fill(accent);

    /* texts */
    useBold(doc);
    doc.fillColor(C.inkMuted).fontSize(8)
      .text(type, xPos + 12, sy + 12, { width: hw - 28, align: 'right' });

    useBold(doc);
    doc.fillColor(C.ink).fontSize(13)
      .text(name, xPos + 12, sy + 28, { width: hw - 28, align: 'right' });

    useRegular(doc);
    doc.fillColor(C.inkMuted).fontSize(9)
      .text(detail, xPos + 12, sy + 50, { width: hw - 28, align: 'right' });
  });

  doc.y = sy + h + 18;
};

/* ─────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────── */
const drawSectionTitle = (doc, title) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const sy = doc.y;

  /* icon circle */
  doc.circle(x + w - 14, sy + 10, 10).fill(C.navyMid);

  useBold(doc);
  doc.fillColor(C.inkMid).fontSize(10)
    .text(title, x + 32, sy + 5, { width: w - 56, align: 'right' });

  /* rule */
  doc.moveTo(x + 24, sy + 20)
    .lineTo(x + w - 28, sy + 20)
    .lineWidth(0.4)
    .stroke(C.border);

  useRegular(doc);
  doc.y = sy + 28;
};

/* ─────────────────────────────────────────────
   DIAGNOSIS BOX
───────────────────────────────────────────── */
const drawDiagnosis = (doc, text) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const sy = doc.y;

  /* measure text height */
  const textH = doc.heightOfString(text || 'لا يوجد تشخيص مسجل', {
    width: w - 40, align: 'right', lineGap: 4,
  });
  const boxH = textH + 24;

  doc.roundedRect(x, sy, w, boxH, 8).fill(C.tealLight);
  doc.roundedRect(x, sy, w, boxH, 8).lineWidth(0.5).stroke('rgba(13,126,117,0.2)');
  /* left accent */
  doc.roundedRect(x, sy, 4, boxH, 2).fill(C.teal);

  doc.fillColor(C.ink).fontSize(12)
    .text(text || 'لا يوجد تشخيص مسجل', x + 16, sy + 12, {
      width: w - 40, align: 'right', lineGap: 4,
    });

  doc.y = sy + boxH + 16;
};

/* ─────────────────────────────────────────────
   MEDICATION ROWS
───────────────────────────────────────────── */
const drawMedications = (doc, lines) => {
  const x = leftX(doc);
  const w = pageW(doc);

  /* outer border */
  const startY = doc.y;

  lines.forEach((item, i) => {
    const isEven = i % 2 === 0;
    const rowH = typeof item === 'object' && item.detail ? 36 : 24;
    const rowY = doc.y;

    /* alternate bg */
    doc.rect(x, rowY, w, rowH).fill(isEven ? C.cream : C.white);

    /* bottom rule */
    if (i < lines.length - 1) {
      doc.moveTo(x + 16, rowY + rowH)
        .lineTo(x + w - 16, rowY + rowH)
        .lineWidth(0.3)
        .stroke(C.border);
    }

    /* number badge */
    const badgeColor = isEven ? C.navyMid : C.teal;
    doc.circle(x + w - 18, rowY + (rowH / 2), 8).fill(badgeColor);
    doc.fillColor(C.white).fontSize(7)
      .text(`${i + 1}`, x + w - 24, rowY + (rowH / 2) - 4, {
        width: 12, align: 'center',
      });

    /* text */
    if (typeof item === 'object' && item.name) {
      useBold(doc);
      doc.fillColor(C.ink).fontSize(11)
        .text(item.name, x + 16, rowY + 6, { width: w - 48, align: 'right' });

      if (item.detail) {
        useRegular(doc);
        doc.fillColor(C.inkMuted).fontSize(9)
          .text(item.detail, x + 16, rowY + 21, { width: w - 48, align: 'right' });
      }
    } else {
      useRegular(doc);
      doc.fillColor(C.ink).fontSize(11)
        .text(String(item), x + 16, rowY + 6, { width: w - 48, align: 'right' });
    }

    doc.y = rowY + rowH;
  });

  /* outer border rect */
  const totalH = doc.y - startY;
  doc.roundedRect(x, startY, w, totalH, 10)
    .lineWidth(0.5)
    .stroke(C.border);

  doc.y += 16;
};

/* ─────────────────────────────────────────────
   NOTES BOX
───────────────────────────────────────────── */
const drawNotes = (doc, text) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const sy = doc.y;

  const textH = doc.heightOfString(text, { width: w - 40, align: 'right', lineGap: 4 });
  const boxH = textH + 24;

  doc.roundedRect(x, sy, w, boxH, 8).fill(C.goldPale);
  doc.roundedRect(x, sy, w, boxH, 8).lineWidth(0.5).stroke('rgba(201,168,76,0.25)');
  doc.roundedRect(x, sy, 4, boxH, 2).fill(C.gold);

  doc.fillColor(C.inkMid).fontSize(11)
    .text(text, x + 16, sy + 12, { width: w - 40, align: 'right', lineGap: 4 });

  doc.y = sy + boxH + 16;
};

/* ─────────────────────────────────────────────
   SIGNATURE ROW
───────────────────────────────────────────── */
const drawSignatureRow = (doc) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const sy = doc.y + 12;

  /* stamp circle */
  const cxStamp = x + 44;
  const cyStamp = sy + 36;
  doc.circle(cxStamp, cyStamp, 36).lineWidth(1).dash(3, { space: 3 }).stroke('rgba(201,168,76,0.35)');
  doc.circle(cxStamp, cyStamp, 28).lineWidth(0.5).stroke('rgba(201,168,76,0.2)');
  doc.fillColor('rgba(201,168,76,0.4)').fontSize(8)
    .text('ختم العيادة', cxStamp - 22, cyStamp - 6, { width: 44, align: 'center' });

  /* signature lines */
  const sigs = [
    { label: 'توقيع الطبيب', lx: x + w - 160 },
    { label: 'توقيع الصيدلي', lx: x + w - 310 },
  ];

  sigs.forEach(({ label, lx }) => {
    doc.moveTo(lx, sy + 62).lineTo(lx + 120, sy + 62)
      .lineWidth(0.7).stroke(C.ink);

    doc.fillColor(C.inkMuted).fontSize(8)
      .text(label, lx, sy + 66, { width: 120, align: 'center' });
  });

  doc.y = sy + 80;
};

/* ─────────────────────────────────────────────
   FOOTER BAR
───────────────────────────────────────────── */
const addFooter = (doc, prescription) => {
  const x = leftX(doc);
  const w = pageW(doc);
  const footerY = doc.page.height - doc.page.margins.bottom - 28;

  doc.rect(x, footerY, w, 28).fill(C.navy);

  /* left: rx id + expiry */
  const rxId = `RX-${(prescription?.id || '').slice(-8).toUpperCase() || 'N/A'}`;
  doc.fillColor('rgba(201,168,76,0.6)').fontSize(8)
    .text(rxId, x + 12, footerY + 10, { width: 200, align: 'left' });

  /* right: disclaimer */
  doc.fillColor('rgba(255,255,255,0.3)').fontSize(8)
    .text(
      'هذه الروشتة صادرة إلكترونياً · صالحة لمدة 7 أيام من تاريخ الإصدار',
      x + 16, footerY + 10,
      { width: w - 32, align: 'right' }
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

  /* ── register fonts ── */
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
    doc.registerFont('Bold', fontRegular);
    doc._hasBold = true;
  }

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  /* ══ layout ══ */
  addHeader(doc, clinicName, prescription);

  drawInfoCards(doc, prescription);

  drawSectionTitle(doc, 'التشخيص');
  drawDiagnosis(doc, prescription?.diagnosis);

  drawSectionTitle(doc, 'الأدوية والجرعات');
  const medicationLines = normalizeMedicationLines(prescription);
  drawMedications(doc, medicationLines);

  if (prescription?.notes) {
    drawSectionTitle(doc, 'ملاحظات الطبيب');
    drawNotes(doc, prescription.notes);
  }

  drawSignatureRow(doc);

  addFooter(doc, prescription);

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return { filePath, relativeUrl, filename };
};

module.exports = { createPrescriptionPdf };
