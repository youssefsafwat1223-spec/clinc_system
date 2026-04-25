const prisma = require('./prisma');

const SYSTEM_TEMPLATES = [
  {
    name: 'clinic_review_ar',
    displayName: 'تقييم الزيارة (تلقائي)',
    category: 'UTILITY',
    languageCode: 'ar',
    headerType: 'NONE',
    bodyText:
      'مرحباً {{1}} 👋\n\nنأمل أنك بخير بعد زيارتك لعيادتنا اليوم عند د. {{2}} 🏥\n\nنحب نسمع رأيك! كيف تقيّم تجربتك معنا؟',
    footerText: 'شكراً لثقتكم بعيادتنا',
  },
  {
    name: 'booking_confirmed_ar_v2',
    displayName: 'تأكيد الحجز',
    category: 'UTILITY',
    languageCode: 'ar',
    headerType: 'NONE',
    bodyText:
      '✅ تم تأكيد حجزك بنجاح!\n\nرقم الحجز: *{{1}}*\nالخدمة: {{2}}\nالدكتور: {{3}}\nالموعد: {{4}}\nالوقت: {{5}}\n\nسنرسل لك تذكير قبل الموعد. شكراً لك!',
    footerText: null,
  },
  {
    name: 'booking_cancelled_ar_v2',
    displayName: 'إلغاء الحجز',
    category: 'UTILITY',
    languageCode: 'ar',
    headerType: 'NONE',
    bodyText:
      '❌ نعتذر، تم إلغاء حجزك في العيادة.\n\nرقم الحجز: {{1}}\nالموعد الملغى: {{2}}\n\nنأسف لأي إزعاج، ويسعدنا خدمتك مرة تانية لحجز موعد بديل في أي وقت يناسبك.',
    footerText: null,
  },
  {
    name: 'booking_rejected_ar_v2',
    displayName: 'رفض الحجز',
    category: 'UTILITY',
    languageCode: 'ar',
    headerType: 'NONE',
    bodyText:
      'تعذر تثبيت الموعد المطلوب.\n\nالخدمة: {{1}}\nالسبب: {{2}}\n\nيرجى التواصل معنا لتحديد موعد بديل.',
    footerText: null,
  },
  {
    name: 'booking_rejected_with_alternatives_ar_v2',
    displayName: 'رفض الحجز مع بدائل',
    category: 'UTILITY',
    languageCode: 'ar',
    headerType: 'NONE',
    bodyText:
      'تعذر تثبيت الموعد المطلوب.\n\nالخدمة: {{1}}\nالسبب: {{2}}\n\nالمواعيد البديلة المقترحة:\n- {{3}}\n- {{4}}\n- {{5}}',
    footerText: null,
  },
  {
    name: 'appointment_reminder_ar_v2',
    displayName: 'تذكير بالموعد',
    category: 'UTILITY',
    languageCode: 'ar',
    headerType: 'NONE',
    bodyText:
      '🔔 تذكير بموعدك\n\nمرحباً {{1}}،\nتذكير بموعدك يوم {{2}} الساعة {{3}}.\n\nالدكتور: {{4}}\nالخدمة: {{5}}\n\nنتطلع لرؤيتك!',
    footerText: null,
  },
];

const seedSystemTemplates = async () => {
  let created = 0;
  for (const template of SYSTEM_TEMPLATES) {
    const result = await prisma.campaignTemplate.upsert({
      where: { name: template.name },
      update: {},
      create: { ...template, active: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    }
  }
  if (created > 0) {
    console.log(`[Seed] Registered ${created} system template(s) in campaign_templates`);
  }
};

module.exports = { seedSystemTemplates };
