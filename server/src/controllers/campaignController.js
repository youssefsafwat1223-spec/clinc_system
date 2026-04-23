const prisma = require('../lib/prisma');
const whatsappService = require('../services/whatsappService');

const sendBroadcast = async (req, res, next) => {
  try {
    const { platform = 'WHATSAPP', audience = 'ALL', messageText, broadcastType = 'TEXT', templateName, imageUrl } = req.body;
    
    // Validate
    if (broadcastType === 'TEXT' && !messageText) {
      return res.status(400).json({ error: 'يرجى إدخال نص الرسالة' });
    }
    if (broadcastType === 'TEMPLATE' && !templateName) {
      return res.status(400).json({ error: 'يرجى إدخال اسم الـ Template المعتمد من ميتا' });
    }

    if (platform !== 'WHATSAPP') {
      return res.status(400).json({ error: 'الحملات متاحة للواتساب فقط حالياً' });
    }

    if (audience !== 'ALL') {
      return res.status(400).json({ error: 'هذا الجمهور غير مدعوم حالياً' });
    }

    const patients = await prisma.patient.findMany({
      where: { platform: 'WHATSAPP', phone: { not: '' } },
      select: { id: true, phone: true, name: true }
    });

    if (patients.length === 0) {
      return res.status(400).json({ error: 'لا يوجد مرضى متطابقين في قاعدة البيانات' });
    }

    let successCount = 0;
    let failCount = 0;

    // Send the blast
    for (const patient of patients) {
      try {
        if (broadcastType === 'TEMPLATE') {
          // Send Meta approved template (can include image headers)
          await whatsappService.sendTemplateMessage(patient.phone, templateName, 'ar', imageUrl);
        } else {
          // Fallback to text (only works if within 24hr window)
          const personalizedMsg = messageText.replace(/{{name}}/g, patient.name);
          await whatsappService.sendTextMessage(patient.phone, personalizedMsg);
        }
        successCount++;
        
        // Minor delay to prevent Facebook rate limit blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to send broadcast to ${patient.phone}:`, error.message);
        failCount++;
      }
    }

    res.json({
      success: true,
      summary: `تم الإرسال لعدد ${successCount} مريض، وفشل ${failCount}.`
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { sendBroadcast };
