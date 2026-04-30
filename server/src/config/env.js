require('dotenv').config();

process.env.TZ = process.env.TZ || process.env.CLINIC_TIMEZONE || 'Asia/Baghdad';

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:5173',

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'clinic_verify_token',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  },

  facebook: {
    pageAccessToken: process.env.FB_PAGE_ACCESS_TOKEN,
    verifyToken: process.env.FB_VERIFY_TOKEN || 'clinic_fb_verify',
    appSecret: process.env.FB_APP_SECRET,
  },

  instagram: {
    accessToken: process.env.IG_ACCESS_TOKEN,
    verifyToken: process.env.IG_VERIFY_TOKEN || 'clinic_ig_verify',
  },

  clinicWhatsappNumber: process.env.CLINIC_WHATSAPP_NUMBER || '',
};
