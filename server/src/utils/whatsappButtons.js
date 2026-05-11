const config = require('../config/env');
const { formatCurrency, formatDateAr, formatTimeAr } = require('./helpers');

const WHATSAPP_LIST_ROW_LIMIT = 10;

const formatServicePriceLabel = (service = {}) => {
  const from = service.priceFrom;
  const to = service.priceTo;

  if (from != null && to != null) return `${formatCurrency(from)} - ${formatCurrency(to)}`;
  if (from != null) return `من ${formatCurrency(from)}`;
  if (to != null) return `إلى ${formatCurrency(to)}`;
  if (service.price != null) return formatCurrency(service.price);
  return '';
};

const buildWelcomeMessage = (to) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'مرحباً بك في عيادتنا.\nاختر من القائمة الخدمة التي تحتاجها وسنساعدك خطوة بخطوة.',
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
            { id: 'inquiry', title: 'استفسار سريع', description: 'أسئلة عامة عن الخدمات أو المواعيد' },
          ],
        },
      ],
    },
  },
});

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
          rows: services.slice(0, WHATSAPP_LIST_ROW_LIMIT).map((service) => {
            let desc = service.whatsappPriceDescription || formatServicePriceLabel(service);
            if (doctorNames) {
              const doctorDesc = `د. ${doctorNames}`;
              desc = desc ? `${desc} - ${doctorDesc}` : doctorDesc;
            }
            return {
              id: `service_${service.id}`,
              title: service.nameAr.substring(0, 24),
              description: String(desc || '').substring(0, 72),
            };
          }),
        },
      ],
    },
  },
});

const buildDoctorSelection = (to, doctors, serviceName = '') => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: serviceName
        ? `اختر الطبيب المناسب لخدمة ${serviceName}:`
        : 'اختر الطبيب المناسب:',
    },
    action: {
      button: 'عرض الأطباء',
      sections: [
        {
          title: 'الأطباء المتاحون',
          rows: doctors.slice(0, WHATSAPP_LIST_ROW_LIMIT).map((doctor) => ({
            id: `doctor_${doctor.id}`,
            title: doctor.name.substring(0, 24),
            description: String(doctor.description || doctor.specialization || '').substring(0, 72),
          })),
        },
      ],
    },
  },
});

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
      button: 'عرض الأيام',
      sections: [
        {
          title: 'الأيام المتاحة',
          rows: days.slice(0, WHATSAPP_LIST_ROW_LIMIT).map((day) => ({
            id: day.id,
            title: day.title.length > 24 ? day.title.substring(0, 24) : day.title,
            description: String(day.description || '').substring(0, 72),
          })),
        },
      ],
    },
  },
});

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
      button: 'عرض الفترات',
      sections: [
        {
          title: 'الفترات المتاحة',
          rows: periods.slice(0, WHATSAPP_LIST_ROW_LIMIT).map((period) => ({
            id: period.id,
            title: String(period.title || '').substring(0, 24),
            description: String(period.description || '').substring(0, 72),
          })),
        },
      ],
    },
  },
});

const buildTimeSlotSelection = (to, slots, dateLabel = '') => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: `اختر الوقت المناسب${dateLabel ? ` ليوم ${dateLabel}` : ''}:`,
    },
    action: {
      button: 'عرض الأوقات',
      sections: [
        {
          title: 'الأوقات المتاحة',
          rows: slots.slice(0, WHATSAPP_LIST_ROW_LIMIT).map((slot, index) => ({
            id: slot.id || `slot_${index}_${slot.time}`,
            title: String(slot.label || '').substring(0, 24),
            description: slot.doctor ? `د. ${slot.doctor}` : '',
          })),
        },
      ],
    },
  },
});

const buildBookingConfirmation = (to, appointment) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: {
    body: [
      'تم تأكيد حجزك بنجاح.',
      '',
      appointment.bookingRef ? `رقم الحجز: *${appointment.bookingRef}*` : null,
      appointment.bookingRef ? '' : null,
      `الخدمة: ${appointment.service}`,
      `الطبيب: ${appointment.doctor}`,
      `الموعد: ${appointment.date}`,
      `الوقت: ${appointment.time}`,
      '',
      'سنرسل لك تذكيراً قبل الموعد. شكراً لك.',
    ].filter(Boolean).join('\n'),
  },
});

const buildBookingRejection = (to, alternativeSlots) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'list',
    body: {
      text: 'عذراً، الموعد المطلوب غير متاح.\n\nيمكنك اختيار موعد بديل:',
    },
    action: {
      button: 'مواعيد بديلة',
      sections: [
        {
          title: 'المواعيد البديلة',
          rows: alternativeSlots.slice(0, WHATSAPP_LIST_ROW_LIMIT).map((slot, index) => ({
            id: `alt_slot_${index}_${slot.time}`,
            title: String(slot.label || '').substring(0, 24),
            description: String(slot.doctor || '').substring(0, 72),
          })),
        },
      ],
    },
  },
});

const buildPendingMessage = (to, bookingRef) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: {
    body: [
      'تم استلام طلب حجزك بنجاح.',
      '',
      bookingRef ? `رقم الحجز: *${bookingRef}*` : null,
      bookingRef ? '' : null,
      'سيتم مراجعته من قبل العيادة وإبلاغك بالتأكيد قريباً. شكراً لاختيارك عيادتنا.',
    ].filter(Boolean).join('\n'),
  },
});

const buildReminderMessage = (to, appointment) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: {
    body: [
      'تذكير بموعدك',
      '',
      `مرحباً ${appointment.patientName}،`,
      `تذكير بموعدك يوم ${appointment.date} الساعة ${appointment.time}.`,
      '',
      `الطبيب: ${appointment.doctor}`,
      `الخدمة: ${appointment.service}`,
      '',
      'نتطلع لرؤيتك.',
    ].join('\n'),
  },
});

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
            text: 'لحجز موعد، يرجى التواصل معنا عبر WhatsApp:',
            buttons: [
              {
                type: 'web_url',
                url: whatsappUrl,
                title: 'احجز عبر WhatsApp',
              },
            ],
          },
        },
      },
    };
  }

  return {
    recipient: { id: recipientId },
    message: {
      text: `لحجز موعد، تواصل معنا عبر WhatsApp:\n${whatsappUrl}`,
    },
  };
};

const buildTextMessage = (to, text) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'text',
  text: { body: text },
});

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
          rows: appointments.slice(0, WHATSAPP_LIST_ROW_LIMIT).map((appointment) => {
            const dateStr = appointment.scheduledTime ? appointment.scheduledTime.toISOString().split('T')[0] : '';
            return {
              id: `manage_apt_${appointment.id}`,
              title: `${appointment.service?.nameAr?.substring(0, 10)} - ${dateStr}`,
              description: `رقم الحجز: ${appointment.bookingRef}`,
            };
          }),
        },
      ],
    },
  },
});

const buildAppointmentOptions = (to, appointment) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: [
        'إدارة موعدك القادم:',
        `الخدمة: ${appointment.service?.nameAr}`,
        `الطبيب: ${appointment.doctor?.name}`,
        `اليوم: ${formatDateAr(appointment.scheduledTime)}`,
        `الوقت: ${formatTimeAr(appointment.scheduledTime)}`,
        '',
        'ماذا تود أن تفعل؟',
      ].join('\n'),
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: `cancel_apt_${appointment.id}`, title: 'إلغاء الحجز' } },
        { type: 'reply', reply: { id: `resch_apt_${appointment.id}`, title: 'تأجيل الموعد' } },
        { type: 'reply', reply: { id: 'return_main', title: 'القائمة الرئيسية' } },
      ],
    },
  },
});

const buildCancelConfirmation = (to, appointmentId) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: 'هل أنت متأكد من رغبتك في إلغاء هذا الحجز نهائياً؟',
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: `confirm_cancel_${appointmentId}`, title: 'نعم، متأكد' } },
        { type: 'reply', reply: { id: `manage_apt_${appointmentId}`, title: 'تراجع' } },
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
        `الطبيب: ${summary.doctorName}`,
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
