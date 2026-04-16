const express = require('express');
const { manychatWebhook } = require('../controllers/integrationsController');

const router = express.Router();

router.post('/manychat/webhook', manychatWebhook);

module.exports = router;
