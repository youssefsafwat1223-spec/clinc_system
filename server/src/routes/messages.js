const express = require('express');
const messageController = require('../controllers/messageController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), messageController.getAll);
router.get('/conversation/:patientId', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), messageController.getConversation);
router.post('/send', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), messageController.sendManual);
router.post('/:patientId/end', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), messageController.endConversation);
router.post('/:patientId/pause', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), messageController.pauseBot);

module.exports = router;
