const axios = require('axios');
const config = require('../config/env');

const MANYCHAT_SEND_URL = 'https://api.manychat.com/fb/sending/sendContent';

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

const sanitizeQuickReplies = (quickReplies = []) =>
  quickReplies
    .map((reply) => {
      if (!reply || typeof reply !== 'object') return null;

      const caption = String(reply.caption || '').trim().slice(0, 20);
      const type = String(reply.type || '').trim();
      const target = String(reply.target || '').trim();
      const url = String(reply.url || '').trim();

      if (!caption || !type) return null;

      if (type === 'url' && url) {
        return { type, caption, url };
      }

      if (target) {
        return { type, caption, target };
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 11);

const buildMessages = ({ text, imageUrl, buttons = [] }) => {
  const messages = [];
  const trimmedImageUrl = resolvePublicUrl(imageUrl);
  const trimmedText = String(text || '').trim();

  if (trimmedImageUrl) {
    messages.push({
      type: 'image',
      url: trimmedImageUrl,
      buttons: [],
    });
  }

  if (trimmedText) {
    messages.push({
      type: 'text',
      text: trimmedText,
      buttons: Array.isArray(buttons) ? buttons : [],
    });
  }

  return messages;
};

const buildContent = ({ platform, text, imageUrl, quickReplies = [] }) => {
  const content = {
    messages: buildMessages({ text, imageUrl }),
    actions: [],
  };

  if (platform === 'INSTAGRAM') {
    content.type = 'instagram';
  }

  const sanitizedQuickReplies = sanitizeQuickReplies(quickReplies);
  if (sanitizedQuickReplies.length > 0) {
    content.quick_replies = sanitizedQuickReplies;
  }

  return content;
};

const sendContent = async ({ subscriberId, platform, text, imageUrl = '', quickReplies = [] }) => {
  if (!config.manychat.apiKey) {
    throw new Error('ManyChat API key is not configured');
  }

  const payload = {
    subscriber_id: subscriberId,
    data: {
      version: 'v2',
      content: buildContent({ platform, text, imageUrl, quickReplies }),
    },
  };

  const response = await axios.post(MANYCHAT_SEND_URL, payload, {
    headers: {
      Authorization: `Bearer ${config.manychat.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
};

module.exports = {
  sendContent,
};
