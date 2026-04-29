const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

router.get('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), prescriptionController.getAll);
router.get('/resolve', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), prescriptionController.resolve);
router.post('/', requireRole('ADMIN', 'DOCTOR'), prescriptionController.create);
router.post('/:id/send', requireRole('ADMIN', 'DOCTOR'), prescriptionController.sendToWhatsApp);

module.exports = router;
