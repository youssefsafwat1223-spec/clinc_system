const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.use(auth);

// All staff can view and manage notifications
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), notificationController.getNotifications);
router.put('/mark-all-read', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), notificationController.markAllAsRead);
router.put('/:id/read', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), notificationController.markAsRead);

module.exports = router;
