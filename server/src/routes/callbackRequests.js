const express = require('express');
const { list, updateStatus } = require('../controllers/callbackRequestController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION'), list);
router.put('/:id', requireRole('ADMIN', 'STAFF', 'RECEPTION'), updateStatus);

module.exports = router;
