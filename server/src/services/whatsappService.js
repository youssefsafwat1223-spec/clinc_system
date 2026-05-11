const axios = require('axios');
const config = require('../config/env');
const prisma = require('../lib/prisma');

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`;

const resolvePublicUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = String(config.publicBaseUrl || '').trim();
  if (!base) return raw;

  try {
    return new URL(raw, base.endsWith('/') ? base : `${base}/`).toString();
  } catch (error) {
    return raw;
  }
};

const sendMessage = async (messageData) => {
  if (!config.whatsapp.token) {
    console.log('[WhatsApp] Token not configured. Message:', JSON.stringify(messageData, null, 2));
    return { success: false, mock: true, message: 'WhatsApp token not configured' };
  }

  try {
    const response = await axios.post(WHATSAPP_API_URL, messageData, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
        'Content-Type': 'application/json',
      },
    });
    console.log('[WhatsApp] Message sent successfully:', response.data);

    try {
      if (messageData.to) {
        const patient = await prisma.patient.findFirst({ where: { phone: messageData.to } });
        if (patient) {
          let textContent = '[رد آلي]';

          if (messageData.type === 'text' && messageData.text) {
            textContent = messageData.text.body;
          } else if (messageData.type === 'image' && messageData.image) {
            textContent = `[صورة] ${messageData.image.caption || 'مرفق صورة'}`;
          } else if (messageData.type === 'document' && messageData.document) {
            textContent = `[ملف] ${messageData.document.caption || messageData.document.filename || 'مرفق'}`;
          } else if (messageData.type === 'interactive') {
            if (messageData.interactive.type === 'list') {
              textContent = `[قائمة خيارات] ${messageData.interactive.body?.text || ''}`;
            } else if (messageData.interactive.type === 'button') {
              textContent = `[أزرار خيارات] ${messageData.interactive.body?.text || ''}`;
            }
          } else if (messageData.type === 'template' && messageData.template) {
            const templateName = messageData.template.name || '';
            const bodyComponent = (messageData.template.components || []).find((component) => component.type === 'body');
            const params = (bodyComponent?.parameters || []).map((param) => param.text).filter(Boolean);
            const paramsSuffix = params.length ? ` (${params.join(' • ')})` : '';

            if (/review/i.test(templateName)) {
              textContent = `[طلب تقييم الزيارة]${paramsSuffix}`;
            } else if (/confirmed/i.test(templateName)) {
              textContent = `[تأكيد حجز]${paramsSuffix}`;
            } else if (/cancelled|canceled/i.test(templateName)) {
              textContent = `[إلغاء حجز]${paramsSuffix}`;
            } else if (/rejected/i.test(templateName)) {
              textContent = `[رفض حجز]${paramsSuffix}`;
            } else if (/reminder/i.test(templateName)) {
              textContent = `[تذكير بالموعد]${paramsSuffix}`;
            } else {
              textContent = `[قالب: ${templateName}]${paramsSuffix}`;
            }
          }

          await prisma.message.create({
            data: {
              patientId: patient.id,
              platform: 'WHATSAPP',
              content: textContent,
              type: 'OUTBOUND',
            },
          });
        }
      }
    } catch (dbError) {
      console.error('[WhatsApp] Failed to save outbound message to DB:', dbError.message);
    }

    return { success: true, data: response.data };
  } catch (error) {
    console.error('[WhatsApp] Send error:', error.response?.data || error.message);
    throw error;
  }
};

const sendTextMessage = async (to, text) =>
  sendMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  });

const sendImageMessage = async (to, imageUrl, caption = '') =>
  sendMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: {
      link: resolvePublicUrl(imageUrl),
      ...(caption ? { caption } : {}),
    },
  });

const sendDocumentMessage = async (to, documentUrl, filename, caption = '') =>
  sendMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: resolvePublicUrl(documentUrl),
      filename,
      ...(caption ? { caption } : {}),
    },
  });

const sendInteractiveMessage = async (messageData) => sendMessage(messageData);

const markAsRead = async (messageId) => {
  if (!config.whatsapp.token) return;

  try {
    await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[WhatsApp] Mark read error:', error.message);
  }
};

const sendTemplateMessage = async (
  to,
  templateName,
  languageCode = 'ar',
  imageUrl = null,
  bodyParams = [],
  headerMedia = null
) => {
  const components = [];

  const resolvedHeaderMedia =
    headerMedia && headerMedia.link
      ? headerMedia
      : imageUrl
        ? { type: 'image', link: imageUrl }
        : null;

  if (resolvedHeaderMedia) {
    if (resolvedHeaderMedia.type === 'document') {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'document',
            document: {
              link: resolvedHeaderMedia.link,
              ...(resolvedHeaderMedia.filename ? { filename: resolvedHeaderMedia.filename } : {}),
            },
          },
        ],
      });
    } else if (resolvedHeaderMedia.type === 'video') {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'video',
            video: { link: resolvedHeaderMedia.link },
          },
        ],
      });
    } else {
      components.push({
        type: 'header',
        parameters: [
          {
            type: 'image',
            image: { link: resolvedHeaderMedia.link },
          },
        ],
      });
    }
  }

  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map((param) => {
        if (param && typeof param === 'object') {
          const parameterName = param.parameter_name || param.parameterName || param.name;
          const text = param.text ?? param.value ?? '';
          return {
            type: 'text',
            text: String(text),
            ...(parameterName ? { parameter_name: String(parameterName) } : {}),
          };
        }

        return { type: 'text', text: String(param) };
      }),
    });
  }

  return sendMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components.length > 0 ? components : undefined,
    },
  });
};

module.exports = {
  sendMessage,
  sendTextMessage,
  sendImageMessage,
  sendDocumentMessage,
  sendInteractiveMessage,
  sendTemplateMessage,
  markAsRead,
};
