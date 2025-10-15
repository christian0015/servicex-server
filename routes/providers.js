const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');
const {authenticate} = require('../middlewares/auth');

// 🔓 Routes publiques
router.get('/', providerController.getAllProviders);
router.get('/search', providerController.searchProviders);
router.get('/trending', providerController.getTrendingProviders);
router.get('/:id', providerController.getProviderById);
router.get('/:id/badges', providerController.getProviderBadges);
router.get('/:id/availability', providerController.getProviderAvailability);
router.get('/:id/ranking', providerController.getProviderRanking);

// 🔐 Routes authentifiées
router.post('/:id/contact', authenticate, providerController.contactProvider);
router.post('/:id/reviews', authenticate, providerController.addProviderReview);

// 🔐 Routes prestataires (propre profil)
router.put('/:id', authenticate, providerController.updateProvider);
router.put('/:id/services', authenticate, providerController.updateProviderServices); // ← AJOUT ICI
router.put('/:id/status', authenticate, providerController.updateProviderStatus);
router.put('/:id/availability', authenticate, providerController.updateProviderAvailability);
router.get('/:id/stats', authenticate, providerController.getProviderStats);

// 🔐 Routes admin/prestataire
router.delete('/:id', authenticate, providerController.deleteProvider);

module.exports = router;