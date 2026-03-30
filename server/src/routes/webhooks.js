const express = require('express');
const {
  whatsappVerify, whatsappWebhook,
  messengerVerify, messengerWebhook,
  instagramVerify, instagramWebhook,
} = require('../controllers/webhookController');

const router = express.Router();

// WhatsApp
router.get('/whatsapp', whatsappVerify);
router.post('/whatsapp', whatsappWebhook);

// Facebook Messenger
router.get('/messenger', messengerVerify);
router.post('/messenger', messengerWebhook);

// Instagram
router.get('/instagram', instagramVerify);
router.post('/instagram', instagramWebhook);

module.exports = router;
