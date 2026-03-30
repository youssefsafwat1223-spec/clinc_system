const express = require('express');
const router = express.Router();
const consultationController = require('../controllers/consultationController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

router.get('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), consultationController.getAll);
router.post('/:id/reply', requireRole('ADMIN', 'DOCTOR'), consultationController.reply);
router.post('/:id/close', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), consultationController.close);

module.exports = router;
