const express = require('express');
const { listDiscounts, saveDiscount, removeDiscount } = require('../controllers/patientController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION'), listDiscounts);
router.post('/', requireRole('ADMIN', 'STAFF'), saveDiscount);
router.put('/:id', requireRole('ADMIN', 'STAFF'), saveDiscount);
router.delete('/:id', requireRole('ADMIN'), removeDiscount);

module.exports = router;
