const express = require('express');
const { getStats } = require('../controllers/analyticsController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), getStats);

module.exports = router;
