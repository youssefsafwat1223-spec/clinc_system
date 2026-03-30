const express = require('express');
const { getAll, getOne, getMine, create, update, updateMySchedule, remove } = require('../controllers/doctorController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/me', requireRole('DOCTOR'), getMine);
router.put('/me/schedule', requireRole('DOCTOR'), updateMySchedule);
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), getAll);
router.get('/:id', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), getOne);
router.post('/', requireRole('ADMIN'), create);
router.put('/:id', requireRole('ADMIN'), update);
router.delete('/:id', requireRole('ADMIN'), remove);

module.exports = router;
