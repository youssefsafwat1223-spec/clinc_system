const express = require('express');
const { login, getMe, changePassword } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', auth, getMe);
router.post('/change-password', auth, changePassword);

module.exports = router;
