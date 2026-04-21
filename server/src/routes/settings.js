const express = require('express');
const { get, getPublic, update, preview, importKnowledgeCases, previewKnowledgeImport } = require('../controllers/settingsController');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public endpoint (no auth) - must be BEFORE auth middleware
router.get('/public', getPublic);

router.use(auth);
router.get('/', requireRole('ADMIN'), get);
router.put('/', requireRole('ADMIN'), update);
router.post('/preview', requireRole('ADMIN'), preview);
router.post('/import-knowledge/preview', requireRole('ADMIN'), previewKnowledgeImport);
router.post('/import-knowledge', requireRole('ADMIN'), importKnowledgeCases);

module.exports = router;
