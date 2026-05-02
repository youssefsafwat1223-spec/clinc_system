const config = require('../config/env');
const { formatCurrency } = require('./helpers');

/**
 * Build WhatsApp welcome message with quick reply buttons
 */
const buildWelcomeMessageLegacy = (to) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'مرحبًا بك في عيادتنا 👋\nكيف يمكننا مساعدتك اليوم؟',
    },
    action: {
      button: 'القائمة الرئيسية',
      sections: [
        {
          title: 'خدمات العيادة',
          rows: [
            { id: 'book_appointment', title: '📅 احجز موعد جديد', description: 'حجز كشف أو استشارة' },
            { id: 'check_appointment', title: '🔍 استعلام عن حجز', description: 'معرفة حالة الحجز برقم المرجع' },
            { id: 'request_consultation', title: '💬 استشارة أونلاين', description: 'إرسال سؤال طبي للدكتور' },
            { id: 'manage_bookings', title: '📋 إدارة حجوزاتي', description: 'عرض أو إلغاء أو تأجيل حجز' },
            { id: 'request_reception', title: '🙋‍♂️ التحدث للإدارة', description: 'التواصل مع موظف الاستقبال' },
            { id: 'inquiry', title: '❓ استفسار آلي', description: 'سؤال المساعد الآلي للعيادة' },
          ],
        },
      ],
    },
  },
});

const buildWelcomeMessageWithLongFooter = (to) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'مرحباً بك في عيادتنا\nاختر من القائمة الخدمة التي تحتاجها، وسنساعدك خطوة بخطوة في الحجز أو الاستفسار أو متابعة مواعيدك.',
    },
    footer: {
      text: 'إذا كنت محتار، ابدأ بـ "احجز موعد جديد" أو "استفسار آلي سريع".',
    },
    action: {
      button: 'القائمة الرئيسية',
      sections: [
        {
          title: 'الخدمات السريعة',
          rows: [
            { id: 'book_appointment', title: 'احجز موعد جديد', description: 'ابدأ الحجز وحدد الخدمة والطبيب والوقت' },
            { id: 'check_appointment', title: 'استعلام عن حجز', description: 'اعرف حالة الموعد برقم الحجز' },
            { id: 'request_consultation', title: 'استشارة أولية', description: 'أرسل سؤالك أو وصف الحالة للطبيب' },
            { id: 'manage_bookings', title: 'إدارة حجوزاتي', description: 'عرض أو تعديل أو إلغاء موعد موجود' },
            { id: 'request_reception', title: 'التحدث مع الاستقبال', description: 'تحويلك لموظف خدمة العملاء' },
            { id: 'inquiry', title: 'استفسار آلي سريع', description: 'أسئلة عامة عن الخدمات أو المواعيد' },
          ],
        },
      ],
    },
  },
});

const buildWelcomeMessage = (to) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'مرحباً بك في عيادتنا\nاختر من القائمة الخدمة التي تحتاجها وسنساعدك خطوة بخطوة.',
    },
    footer: {
      text: 'ابدأ بالحجز أو اختر استفسار سريع',
    },
    action: {
      button: 'القائمة الرئيسية',
      sections: [
        {
          title: 'الخدمات السريعة',
          rows: [
            { id: 'book_appointment', title: 'احجز موعد جديد', description: 'ابدأ الحجز وحدد الخدمة والطبيب' },
            { id: 'check_appointment', title: 'استعلام عن حجز', description: 'اعرف حالة الحجز برقم المرجع' },
            { id: 'request_consultation', title: 'استشارة أولية', description: 'أرسل سؤالك أو وصف الحالة' },
            { id: 'manage_bookings', title: 'إدارة حجوزاتي', description: 'عرض أو تعديل أو إلغاء موعد' },
            { id: 'request_reception', title: 'التحدث مع الاستقبال', description: 'تحويل المحادثة لموظف مختص' },
            { id: 'inquiry', title: 'استفسار آلي سريع', description: 'أسئلة عامة عن الخدمات أو المواعيد' },
          ],
        },
      ],
    },
  },
});

/**
 * Build service selection buttons (WhatsApp List Message)
 */
const buildServiceSelection = (to, services, doctorNames = '') => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'اختر الخدمة المطلوبة:',
    },
    action: {
      button: 'عرض الخدمات',
      sections: [
        {
          title: 'الخدمات المتاحة',
          rows: services.map((s) => {
            let desc = s.whatsappPriceDescription || (s.price ? formatCurrency(s.price) : '');
            if (doctorNames) {
              const doctorDesc = `د. ${doctorNames}`;
              desc = desc ? `${desc} - ${doctorDesc}` : doctorDesc;
            }
            return {
              id: `service_${s.id}`,
              title: s.nameAr.substring(0, 24),
              description: desc.substring(0, 72),
            };
          }),
        },
      ],
    },
  },
});

/**
 * Build doctor selection buttons (WhatsApp List Message)
 */
const buildDoctorSelection = (to, doctors, serviceName = '') => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: serviceName
        ? `اختر الدكتور المناسب لخدمة ${serviceName}:`
        : 'اختر الدكتور المناسب:',
    },
    action: {
      button: 'عرض الأطباء',
      sections: [
        {
          title: 'الأطباء المتاحون',
          rows: doctors.map((doctor) => ({
            id: `doctor_${doctor.id}`,
            title: doctor.name.substring(0, 24),
            description: (doctor.description || doctor.specialization || '').substring(0, 72),
          })),
        },
      ],
    },
  },
});

/**
 * Build day selection buttons (WhatsApp List Message)
 */
const buildDaySelection = (to, days) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'اختر اليوم المناسب للحجز:',
    },
    action: {
      button: 'عرض الأيام المتاحة',
      sections: [
        {
          title: 'الأيام المتاحة',
          rows: days.map((day) => ({
            id: day.id,
            title: day.title.length > 24 ? day.title.substring(0, 24) : day.title,
            description: day.description || '',
          })),
        },
      ],
    },
  },
});

/**
 * Build period selection buttons (WhatsApp List Message)
 */
const buildPeriodSelection = (to, dateLabel, periods) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: `اختر الفترة المناسبة ليوم ${dateLabel}:`,
    },
    action: {
      button: 'عرض الفترات المتاحة',
      sections: [
        {
          title: 'الفترات المتاحة',
          rows: periods.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
          })),
        },
      ],
    },
  },
});

/**
 * Build time slot selection buttons
 */
const buildTimeSlotSelection = (to, slots, dateLabel = '') => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: `اختر الوقت المناسب${dateLabel ? ` (ليوم ${dateLabel})` : ''}:`,
    },
    action: {
      button: 'عرض الأوقات',
      sections: [
        {
          title: 'الأوقات المتاحة',
          rows: slots.map((slot, index) => {
            // WhatsApp list row title max is 24 chars
            const title = slot.label.length > 24 ? slot.label.substring(0, 24) : slot.label;
            return {
              id: slot.id || `slot_${index}_${slot.time}`,
              title,
              description: slot.doctor ? `👨‍⚕️ ${slot.doctor}` : '',
            };
          }),
        },
      ],
    },
  },
});

/**
 * Build confirmation message after booking
 */
const buildBookingConfirmation = (to, appointment) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: {
    body: `✅ تم تأكيد حجزك بنجاح!\n\n${appointment.bookingRef ? `رقم الحجز: *${appointment.bookingRef}*\n\n` : ''}📋 الخدمة: ${appointment.service}\n👨‍⚕️ الدكتور: ${appointment.doctor}\n📅 الموعد: ${appointment.date}\n⏰ الوقت: ${appointment.time}\n\nسنرسل لك تذكير قبل الموعد. شكراً لك! 🙏`,
  },
});

/**
 * Build rejection message with alternative slots
 */
const buildBookingRejection = (to, alternativeSlots) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: '⚠️ عذراً، الموعد المطلوب غير متاح.\n\nيمكنك اختيار موعد بديل:',
    },
    action: {
      button: 'مواعيد بديلة',
      sections: [
        {
          title: 'المواعيد البديلة',
          rows: alternativeSlots.map((slot, index) => ({
            id: `alt_slot_${index}_${slot.time}`,
            title: slot.label,
            description: slot.doctor || '',
          })),
        },
      ],
    },
  },
});

/**
 * Build pending notification message
 */
const buildPendingMessage = (to, bookingRef) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: {
    body: `⏳ تم استلام طلب حجزك بنجاح!\n\n${bookingRef ? `رقم الحجز: *${bookingRef}*\n\n` : ''}سيتم مراجعته من قبل العيادة وإبلاغك بالتأكيد قريباً. شكراً لاختياركم عيادتنا! 🙏`,
  },
});

/**
 * Build reminder message
 */
const buildReminderMessage = (to, appointment) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: {
    body: `🔔 تذكير بموعدك\n\nمرحبًا ${appointment.patientName}،\nتذكير بموعدك يوم ${appointment.date} الساعة ${appointment.time}.\n\n👨‍⚕️ الدكتور: ${appointment.doctor}\n📋 الخدمة: ${appointment.service}\n\nنتطلع لرؤيتك! 😊`,
  },
});

/**
 * Build Facebook/Instagram redirect button to WhatsApp
 */
const buildWhatsAppRedirectButton = (recipientId, platform = 'facebook') => {
  const whatsappUrl = `https://wa.me/${config.clinicWhatsappNumber}?text=${encodeURIComponent('أريد حجز موعد')}`;

  if (platform === 'facebook') {
    return {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: 'template',
          payload: {
            template_type: 'button',
            text: '📅 لحجز موعد، يرجى التواصل معنا عبر WhatsApp:',
            buttons: [
              {
                type: 'web_url',
                url: whatsappUrl,
                title: '📱 احجز عبر WhatsApp',
              },
            ],
          },
        },
      },
    };
  }

  // Instagram - use text with link
  return {
    recipient: { id: recipientId },
    message: {
      text: `📅 لحجز موعد، تواصل معنا عبر WhatsApp:\n${whatsappUrl}`,
    },
  };
};

/**
 * Build simple text message for WhatsApp
 */
const buildTextMessage = (to, text) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: { body: text },
});

/**
 * Build interactive list of active appointments for the patient
 */
const buildAppointmentsList = (to, appointments) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'إليك قائمة بمواعيدك القادمة. يرجى اختيار الموعد الذي تود إدارته:',
    },
    action: {
      button: 'عرض المواعيد',
      sections: [
        {
          title: 'مواعيدي',
          rows: appointments.map((apt) => {
            const dateStr = apt.scheduledTime ? (apt.scheduledTime.toISOString().split('T')[0]) : '';
            return {
              id: `manage_apt_${apt.id}`,
              title: `${apt.service?.nameAr?.substring(0, 10)} - ${dateStr}`,
              description: `رقم الحجز: ${apt.bookingRef}`,
            };
          }),
        },
      ],
    },
  },
});

/**
 * Build interactive action buttons for a specific appointment
 */
const buildAppointmentOptions = (to, appointment) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: `إدارة موعدك القادم:\n📋 الخدمة: ${appointment.service?.nameAr}\n👨‍⚕️ الدكتور: ${appointment.doctor?.name}\n📅 الموعد: ${appointment.scheduledTime.toLocaleString('ar-EG')}\n\nماذا تود أن تفعل؟`,
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: `cancel_apt_${appointment.id}`, title: '❌ إلغاء الحجز' } },
        { type: 'reply', reply: { id: `resch_apt_${appointment.id}`, title: '📅 تأجيل الموعد' } },
        { type: 'reply', reply: { id: `return_main`, title: '🏠 القائمة الرئيسية' } },
      ],
    },
  },
});

/**
 * Build cancellation confirmation buttons
 */
const buildCancelConfirmation = (to, appointmentId) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: '⚠️ هل أنت متأكد من رغبتك في إلغاء هذا الحجز نهائياً؟',
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: `confirm_cancel_${appointmentId}`, title: '✅ نعم، متأكد' } },
        { type: 'reply', reply: { id: `manage_apt_${appointmentId}`, title: '❌ تراجع' } },
      ],
    },
  },
});

const buildTextBookingConfirmation = (to, summary) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: [
        'تأكيد بيانات الحجز:',
        '',
        `الخدمة: ${summary.serviceName}`,
        `الدكتور: ${summary.doctorName}`,
        `اليوم: ${summary.dayLabel}`,
        `التاريخ: ${summary.dateLabel}`,
        `الوقت: ${summary.timeLabel}`,
        '',
        'هل تريد تأكيد طلب الحجز؟',
      ].join('\n'),
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'confirm_text_booking', title: 'موافق' } },
        { type: 'reply', reply: { id: 'cancel_text_booking', title: 'لا / تعديل' } },
      ],
    },
  },
});

module.exports = {
  buildWelcomeMessage,
  buildServiceSelection,
  buildDoctorSelection,
  buildDaySelection,
  buildPeriodSelection,
  buildTimeSlotSelection,
  buildBookingConfirmation,
  buildBookingRejection,
  buildPendingMessage,
  buildReminderMessage,
  buildWhatsAppRedirectButton,
  buildTextMessage,
  buildAppointmentsList,
  buildAppointmentOptions,
  buildCancelConfirmation,
  buildTextBookingConfirmation,
};
