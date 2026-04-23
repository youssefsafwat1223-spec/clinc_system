const axios = require('axios');
const config = require('../config/env');
const prisma = require('../lib/prisma');

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`;

/**
 * Send a WhatsApp message via Meta Cloud API
 */
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

    // Automatically log outbound message to database
    try {
      if (messageData.to) {
        const patient = await prisma.patient.findFirst({ where: { phone: messageData.to } });
        if (patient) {
          let textContent = '[رد آلي]';
          if (messageData.type === 'text' && messageData.text) {
            textContent = messageData.text.body;
          } else if (messageData.type === 'document' && messageData.document) {
            textContent = `[ملف] ${messageData.document.caption || messageData.document.filename || 'مرفق'}`;
          } else if (messageData.type === 'interactive') {
            if (messageData.interactive.type === 'list') {
              textContent = `[قائمة خيارات] ${messageData.interactive.body?.text || ''}`;
            } else if (messageData.interactive.type === 'button') {
              textContent = `[أزرار خيارات] ${messageData.interactive.body?.text || ''}`;
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

/**
 * Send a text message
 */
const sendTextMessage = async (to, text) => {
  return sendMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  });
};

const sendDocumentMessage = async (to, documentUrl, filename, caption = '') => {
  return sendMessage({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: documentUrl,
      filename,
      ...(caption ? { caption } : {}),
    },
  });
};

/**
 * Send an interactive message (buttons, lists)
 */
const sendInteractiveMessage = async (messageData) => {
  return sendMessage(messageData);
};

/**
 * Mark a message as read
 */
const markAsRead = async (messageId) => {
  if (!config.whatsapp.token) return;

  try {
    await axios.post(WHATSAPP_API_URL, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[WhatsApp] Mark read error:', error.message);
  }
};

/**
 * Send an approved Meta Message Template (for broadcasts outside 24h window)
 * @param bodyParams array of strings for variables {{1}}, {{2}}, etc.
 */
const sendTemplateMessage = async (to, templateName, languageCode = 'ar', imageUrl = null, bodyParams = []) => {
  const components = [];

  // If an image URL is provided, attach it as a header parameter
  if (imageUrl) {
    components.push({
      type: 'header',
      parameters: [
        {
          type: 'image',
          image: { link: imageUrl }
        }
      ]
    });
  }

  // If there are body variables (e.g., patientName, date, time), attach them
  if (bodyParams && bodyParams.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParams.map(text => ({ type: 'text', text: String(text) }))
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
  sendDocumentMessage,
  sendInteractiveMessage,
  sendTemplateMessage,
  markAsRead,
};
