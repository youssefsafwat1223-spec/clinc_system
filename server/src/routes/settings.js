const express = require('express');
const { get, update, preview, importKnowledgeCases, previewKnowledgeImport } = require('../controllers/settingsController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(auth);
router.get('/', requireRole('ADMIN'), get);
router.put('/', requireRole('ADMIN'), update);
router.post('/preview', requireRole('ADMIN'), preview);
router.post('/import-knowledge/preview', requireRole('ADMIN'), previewKnowledgeImport);
router.post('/import-knowledge', requireRole('ADMIN'), importKnowledgeCases);

module.exports = router;
