const express = require('express');
const { getAll, getPublic, create, update, remove } = require('../controllers/serviceController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public endpoint - no auth required
router.get('/public', getPublic);

router.use(auth);
router.get('/', getAll);
router.post('/', requireRole('ADMIN'), create);
router.put('/:id', requireRole('ADMIN'), update);
router.delete('/:id', requireRole('ADMIN'), remove);

module.exports = router;
