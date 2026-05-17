const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

router.get('/templates', requireRole('ADMIN', 'STAFF'), campaignController.listTemplates);
router.get('/segments', requireRole('ADMIN', 'STAFF'), campaignController.listSegments);
router.post('/templates', requireRole('ADMIN'), campaignController.createTemplate);
router.put('/templates/:id', requireRole('ADMIN'), campaignController.updateTemplate);
router.delete('/templates/:id', requireRole('ADMIN'), campaignController.removeTemplate);
router.post('/broadcast', requireRole('ADMIN', 'STAFF'), campaignController.sendBroadcast);
router.post('/send-offers', requireRole('ADMIN', 'STAFF'), campaignController.sendOffers);

router.get('/offer-drafts', requireRole('ADMIN', 'STAFF'), campaignController.listOfferDrafts);
router.post('/offer-drafts', requireRole('ADMIN', 'STAFF'), campaignController.createOfferDraft);
router.put('/offer-drafts/:id', requireRole('ADMIN', 'STAFF'), campaignController.updateOfferDraft);
router.delete('/offer-drafts/:id', requireRole('ADMIN'), campaignController.deleteOfferDraft);

module.exports = router;
