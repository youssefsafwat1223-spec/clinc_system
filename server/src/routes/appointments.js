const express = require('express');
const { getAll, getOne, create, confirm, reject, update, block, complete, noShow, cancel, getStats, availability, previewRescheduleByDoctor, rescheduleByDoctor, assignQueuePosition, updateQueuePosition } = require('../controllers/appointmentController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/stats', getStats);
router.get('/availability/doctors', availability);
router.post('/reschedule-doctor/preview', previewRescheduleByDoctor);
router.post('/reschedule-doctor', rescheduleByDoctor);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.post('/:id/confirm', confirm);
router.post('/:id/reject', reject);
router.post('/:id/block', block);
router.post('/:id/complete', complete);
router.post('/:id/no-show', noShow);
router.post('/:id/cancel', cancel);
router.post('/:id/assign-queue-position', assignQueuePosition);
router.patch('/:id/queue-position', updateQueuePosition);

module.exports = router;
