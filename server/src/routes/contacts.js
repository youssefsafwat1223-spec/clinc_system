const express = require('express');
const contactController = require('../controllers/contactController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN', 'STAFF', 'RECEPTION'), contactController.list);
router.post('/', requireRole('ADMIN', 'STAFF'), contactController.create);
router.put('/:id', requireRole('ADMIN', 'STAFF'), contactController.update);
router.delete('/:id', requireRole('ADMIN'), contactController.remove);

module.exports = router;
