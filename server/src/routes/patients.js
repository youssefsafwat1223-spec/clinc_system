const express = require('express');
const { getAll, getOne, create, update, remove } = require('../controllers/patientController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), getAll);
router.get('/:id', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), getOne);
router.post('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), create);
router.put('/:id', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), update);
router.delete('/:id', requireRole('ADMIN'), remove);

module.exports = router;
