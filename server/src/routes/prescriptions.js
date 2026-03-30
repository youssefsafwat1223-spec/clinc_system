const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

router.get('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), prescriptionController.getAll);
router.post('/', requireRole('ADMIN', 'DOCTOR'), prescriptionController.create);
router.post('/:id/send', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), prescriptionController.sendToWhatsApp);

module.exports = router;
