const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

router.post('/broadcast', requireRole('ADMIN', 'STAFF'), campaignController.sendBroadcast);

module.exports = router;
