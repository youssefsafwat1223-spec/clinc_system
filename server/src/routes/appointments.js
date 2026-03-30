const express = require('express');
const { getAll, getOne, create, confirm, reject, update, block, getStats } = require('../controllers/appointmentController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/stats', getStats);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.post('/:id/confirm', confirm);
router.post('/:id/reject', reject);
router.post('/:id/block', block);

module.exports = router;
