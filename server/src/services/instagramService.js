const axios = require('axios');
const config = require('../config/env');
const prisma = require('../lib/prisma');
const { resolveWhatsAppChatLink } = require('../utils/clinicLinks');

const IG_API_URL = 'https://graph.facebook.com/v18.0/me/messages';

const sendMessage = async (recipientId, messageData) => {
  if (!config.instagram.accessToken) {
    console.log('[Instagram] Token not configured. Message:', JSON.stringify(messageData, null, 2));
    return { success: false, mock: true };
  }

  try {
    const response = await axios.post(IG_API_URL, messageData, {
      params: { access_token: config.instagram.accessToken },
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('[Instagram] Message sent:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[Instagram] Send error:', error.response?.data || error.message);
    throw error;
  }
};

const sendTextMessage = async (recipientId, text, quickReplies = null) => {
  const messageData = {
    recipient: { id: recipientId },
    message: { text },
  };

  if (quickReplies && quickReplies.length > 0) {
    messageData.message.quick_replies = quickReplies.map((qr) => ({
      content_type: 'text',
      title: qr.title.substring(0, 20),
      payload: qr.payload,
    }));
  }

  return sendMessage(recipientId, messageData);
};

const sendWhatsAppRedirect = async (recipientId) => {
  let whatsappUrl = resolveWhatsAppChatLink({ fallbackPhone: config.clinicWhatsappNumber });

  try {
    const settings = await prisma.clinicSettings.findFirst({
      select: { whatsappChatLink: true, phone: true },
    });

    whatsappUrl = resolveWhatsAppChatLink({
      whatsappChatLink: settings?.whatsappChatLink,
      phone: settings?.phone,
      fallbackPhone: config.clinicWhatsappNumber,
    });
  } catch (error) {
    // Keep env fallback when settings lookup fails.
  }

  return sendTextMessage(
    recipientId,
    `لحجز موعد، تواصل معنا عبر WhatsApp:\n${whatsappUrl}`
  );
};

const sendCommentReply = async (commentId, text) => {
  if (!config.instagram.accessToken) return { success: false, mock: true };
  const url = `https://graph.facebook.com/v18.0/${commentId}/replies`;

  try {
    const res = await axios.post(
      url,
      { message: text },
      {
        params: { access_token: config.instagram.accessToken },
      }
    );
    return { success: true, data: res.data };
  } catch (error) {
    console.error('[Instagram] Comment reply error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage,
  sendTextMessage,
  sendWhatsAppRedirect,
  sendCommentReply,
};
