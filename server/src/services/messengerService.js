const axios = require('axios');
const config = require('../config/env');
const prisma = require('../lib/prisma');
const { resolveWhatsAppChatLink } = require('../utils/clinicLinks');

const FB_API_URL = 'https://graph.facebook.com/v18.0/me/messages';

const sendMessage = async (recipientId, messageData) => {
  if (!config.facebook.pageAccessToken) {
    console.log('[Messenger] Token not configured. Message:', JSON.stringify(messageData, null, 2));
    return { success: false, mock: true };
  }

  try {
    const response = await axios.post(FB_API_URL, messageData, {
      params: { access_token: config.facebook.pageAccessToken },
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('[Messenger] Message sent:', response.data);
    return { success: true, data: response.data };
  } catch (error) {
    console.error('[Messenger] Send error:', error.response?.data || error.message);
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

  return sendMessage(recipientId, {
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
  });
};

const sendCommentReply = async (commentId, text) => {
  if (!config.facebook.pageAccessToken) return { success: false, mock: true };
  const url = `https://graph.facebook.com/v18.0/${commentId}/comments`;

  try {
    const res = await axios.post(
      url,
      { message: text },
      {
        params: { access_token: config.facebook.pageAccessToken },
      }
    );
    return { success: true, data: res.data };
  } catch (error) {
    console.error('[Messenger] Comment reply error:', error.response?.data || error.message);
    throw error;
  }
};

const sendPrivateReply = async (commentId, text) => {
  if (!config.facebook.pageAccessToken) return { success: false, mock: true };
  const url = 'https://graph.facebook.com/v18.0/me/messages';

  try {
    const res = await axios.post(
      url,
      {
        recipient: { comment_id: commentId },
        message: { text },
      },
      {
        params: { access_token: config.facebook.pageAccessToken },
      }
    );
    return { success: true, data: res.data };
  } catch (error) {
    console.error('[Messenger] Private reply error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = {
  sendMessage,
  sendTextMessage,
  sendWhatsAppRedirect,
  sendCommentReply,
  sendPrivateReply,
};
