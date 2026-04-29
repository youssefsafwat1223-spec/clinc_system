const express = require('express');
const {
  getAll,
  getOne,
  create,
  update,
  remove,
  listGroups,
  createGroup,
  bulkImport,
  listDiscounts,
  saveDiscount,
  removeDiscount,
} = require('../controllers/patientController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/groups/list', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), listGroups);
router.post('/groups', requireRole('ADMIN', 'STAFF', 'RECEPTION'), createGroup);
router.post('/bulk-import', requireRole('ADMIN', 'STAFF', 'RECEPTION'), bulkImport);
router.get('/discounts/list', requireRole('ADMIN', 'STAFF', 'RECEPTION'), listDiscounts);
router.post('/discounts', requireRole('ADMIN', 'STAFF'), saveDiscount);
router.put('/discounts/:id', requireRole('ADMIN', 'STAFF'), saveDiscount);
router.delete('/discounts/:id', requireRole('ADMIN'), removeDiscount);
router.get('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), getAll);
router.get('/:id', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), getOne);
router.post('/', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), create);
router.put('/:id', requireRole('ADMIN', 'DOCTOR', 'STAFF', 'RECEPTION'), update);
router.delete('/:id', requireRole('ADMIN'), remove);

module.exports = router;
