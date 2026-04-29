const express = require('express');
const paymentController = require('../controllers/paymentController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.list);
router.post('/', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.upsertByAppointment);
router.put('/:id', requireRole('ADMIN', 'STAFF', 'RECEPTION'), paymentController.update);

module.exports = router;
