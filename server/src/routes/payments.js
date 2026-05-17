const express = require('express');
const paymentController = require('../controllers/paymentController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/revenue-report', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.revenueReport);
router.get('/extra-charges', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), paymentController.listExtraCharges);
router.post('/extra-charges', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), paymentController.createExtraCharge);
router.patch('/extra-charges/:id', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.updateExtraCharge);
router.delete('/extra-charges/:id', requireRole('ADMIN'), paymentController.deleteExtraCharge);
router.post('/send-receipt', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.sendReceipt);
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.list);
router.post('/', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.upsertByAppointment);
router.put('/:id', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.update);

module.exports = router;
