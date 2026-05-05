const express = require('express');
const { getAll } = require('../controllers/serviceController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION', 'DOCTOR'), getAll);

module.exports = router;
