const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { buildAiConfig, DEFAULT_FAQS, DEFAULT_KNOWLEDGE_CASES } = require('../src/utils/aiKnowledge');
const { buildWhatsAppChatLink } = require('../src/utils/clinicLinks');

const prisma = new PrismaClient();

const DENTAL_SYSTEM_PROMPT = `أنت مساعد ذكي لعيادة أسنان.
أجب على أسئلة المرضى بأسلوب مهني وواضح ومطمئن.
لا تقدم تشخيصا نهائيا ولا وعودا طبية مبالغا فيها.
اشرح الحالة بشكل مبسط، واذكر متى يفضل عدم التأجيل، ثم وجه المريض إلى الفحص أو الحجز عند الحاجة.
إذا كانت صياغة المريض باللهجة العراقية فحافظ على لهجة بسيطة ومفهومة.`;

const DENTAL_AI_CONFIG = buildAiConfig({
  faqs: DEFAULT_FAQS,
  knowledgeCases: DEFAULT_KNOWLEDGE_CASES,
});

const isLegacyAiConfig = (faqData) => {
  if (!faqData) return true;
  if (Array.isArray(faqData)) return true;
  if (typeof faqData !== 'object') return true;
  if (!Array.isArray(faqData.knowledgeCases)) return true;
  if (faqData.knowledgeCases.length === 0) return true;
  return false;
};

const isLegacyPrompt = (prompt) => {
  const value = String(prompt || '').toLowerCase();
  if (!value.trim()) return true;
  return !value.includes('أسنان') && !value.includes('اسنان');
};

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {
      password: adminPassword,
      name: 'مدير النظام',
      role: 'ADMIN',
      active: true,
    },
    create: {
      email: 'admin@clinic.com',
      password: adminPassword,
      name: 'مدير النظام',
      role: 'ADMIN',
    },
  });
  console.log('Admin user ready:', admin.email);

  const receptionPassword = await bcrypt.hash('reception123', 12);
  const reception = await prisma.user.upsert({
    where: { email: 'reception@clinic.com' },
    update: {
      password: receptionPassword,
      name: 'Reception Desk',
      role: 'RECEPTION',
      active: true,
    },
    create: {
      email: 'reception@clinic.com',
      password: receptionPassword,
      name: 'Reception Desk',
      role: 'RECEPTION',
    },
  });
  console.log('Reception user ready:', reception.email);

  const doctorPassword = await bcrypt.hash('doctor123', 12);
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor@clinic.com' },
    update: {
      password: doctorPassword,
      name: 'د. أحمد محمد',
      role: 'DOCTOR',
      active: true,
    },
    create: {
      email: 'doctor@clinic.com',
      password: doctorPassword,
      name: 'د. أحمد محمد',
      role: 'DOCTOR',
    },
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: doctorUser.id },
    update: {
      name: 'د. أحمد محمد',
      specialization: 'طب الأسنان',
      phone: '+966501234567',
      workingHours: {
        sunday: { start: '09:00', end: '17:00' },
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '14:00' },
        friday: null,
        saturday: null,
      },
    },
    create: {
      name: 'د. أحمد محمد',
      specialization: 'طب الأسنان',
      phone: '+966501234567',
      userId: doctorUser.id,
      workingHours: {
        sunday: { start: '09:00', end: '17:00' },
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '14:00' },
        friday: null,
        saturday: null,
      },
    },
  });
  console.log('Doctor ready:', doctor.name);

  const servicesData = [
    {
      name: 'Dental Consultation',
      nameAr: 'فحص أسنان',
      description: 'فحص وتشخيص أولي لحالة الأسنان واللثة',
      price: 120,
      duration: 30,
    },
    {
      name: 'Teeth Cleaning',
      nameAr: 'تنظيف جير وتلميع',
      description: 'إزالة الجير وتنظيف الأسنان والعناية باللثة',
      price: 180,
      duration: 45,
    },
    {
      name: 'Composite Filling',
      nameAr: 'حشوة تجميلية',
      description: 'علاج التسوس وترميم السن بحشوة تجميلية',
      price: 220,
      duration: 40,
    },
    {
      name: 'Root Canal Treatment',
      nameAr: 'علاج عصب',
      description: 'تنظيف وعلاج عصب السن حسب تقييم الطبيب',
      price: 450,
      duration: 60,
    },
  ];

  for (const data of servicesData) {
    const existing = await prisma.service.findFirst({ where: { name: data.name } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await prisma.service.create({ data });
    }
  }
  console.log('Services ready');

  let settings = await prisma.clinicSettings.findFirst();
  if (!settings) {
    settings = await prisma.clinicSettings.create({
      data: {
        clinicName: 'My Clinic',
        clinicNameAr: 'عيادتي',
        phone: '+966501234567',
        whatsappChatLink: buildWhatsAppChatLink('+966501234567'),
        googleMapsLink: 'https://maps.google.com/?q=%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6%D8%8C%20%D8%A7%D9%84%D9%85%D9%85%D9%84%D9%83%D8%A9%20%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9%20%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9',
        address: 'الرياض، المملكة العربية السعودية',
        systemPrompt: DENTAL_SYSTEM_PROMPT,
        workingHours: {
          sunday: { start: '09:00', end: '17:00' },
          monday: { start: '09:00', end: '17:00' },
          tuesday: { start: '09:00', end: '17:00' },
          wednesday: { start: '09:00', end: '17:00' },
          thursday: { start: '09:00', end: '14:00' },
          friday: null,
          saturday: null,
        },
        faqData: DENTAL_AI_CONFIG,
        aiEnabled: true,
      },
    });
    console.log('Clinic settings created');
  } else {
    const settingsPatch = {};

    if (isLegacyAiConfig(settings.faqData)) {
      settingsPatch.faqData = DENTAL_AI_CONFIG;
    }

    if (isLegacyPrompt(settings.systemPrompt)) {
      settingsPatch.systemPrompt = DENTAL_SYSTEM_PROMPT;
    }

    if (!settings.whatsappChatLink && settings.phone) {
      settingsPatch.whatsappChatLink = buildWhatsAppChatLink(settings.phone);
    }

    if (!settings.googleMapsLink && settings.address) {
      settingsPatch.googleMapsLink = `https://maps.google.com/?q=${encodeURIComponent(settings.address)}`;
    }

    if (Object.keys(settingsPatch).length > 0) {
      settings = await prisma.clinicSettings.update({
        where: { id: settings.id },
        data: settingsPatch,
      });
      console.log('Clinic settings updated to dental defaults');
    } else {
      console.log('Clinic settings already compatible');
    }
  }

  const patient = await prisma.patient.upsert({
    where: { phone: '+966509876543' },
    update: {
      name: 'محمد علي',
      platform: 'WHATSAPP',
      whatsappId: '966509876543',
    },
    create: {
      name: 'محمد علي',
      phone: '+966509876543',
      platform: 'WHATSAPP',
      whatsappId: '966509876543',
    },
  });
  console.log('Sample patient ready:', patient.name);

  console.log('\nSeeding completed');
  console.log('\nLogin credentials:');
  console.log('  Admin: admin@clinic.com / admin123');
  console.log('  Reception: reception@clinic.com / reception123');
  console.log('  Doctor: doctor@clinic.com / doctor123');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
