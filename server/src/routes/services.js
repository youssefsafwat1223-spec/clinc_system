const express = require('express');
const { getAll, getPublic, getDiscount, create, update, remove } = require('../controllers/serviceController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public endpoint - no auth required
router.get('/public', getPublic);

router.use(auth);
router.get('/', getAll);
router.get('/:id/discount', getDiscount);
router.post('/', requireRole('ADMIN', 'DOCTOR', 'STAFF'), create);
router.put('/:id', requireRole('ADMIN'), update);
router.delete('/:id', requireRole('ADMIN'), remove);

module.exports = router;
