const express = require('express');
const staffController = require('../controllers/staffController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN'), staffController.list);
router.post('/', requireRole('ADMIN'), staffController.create);
router.put('/:id', requireRole('ADMIN'), staffController.update);
router.delete('/:id', requireRole('ADMIN'), staffController.remove);

module.exports = router;
