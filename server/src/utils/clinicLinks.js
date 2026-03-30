const config = require('../config/env');

const DEFAULT_WHATSAPP_MESSAGE = '';

const normalizePhoneDigits = (value) => String(value || '').replace(/[^\d]/g, '');

const buildWhatsAppChatLink = (phoneNumber, message = DEFAULT_WHATSAPP_MESSAGE) => {
  const digits = normalizePhoneDigits(phoneNumber);
  if (!digits) return '';
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return `https://wa.me/${digits}`;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(normalizedMessage)}`;
};

const resolveWhatsAppChatLink = ({
  whatsappChatLink,
  phone,
  fallbackPhone = config.clinicWhatsappNumber,
} = {}) => {
  const directLink = String(whatsappChatLink || '').trim();
  if (directLink) return directLink;

  return buildWhatsAppChatLink(phone || fallbackPhone);
};

module.exports = {
  DEFAULT_WHATSAPP_MESSAGE,
  normalizePhoneDigits,
  buildWhatsAppChatLink,
  resolveWhatsAppChatLink,
};
