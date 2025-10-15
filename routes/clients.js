const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticate, authorize } = require('../middlewares/auth');

// Appliquer l'authentification à toutes les routes
router.use(authenticate);

// 📋 Profil et compte
router.get('/profile', clientController.getClientProfile);
router.get('/profile/:id', authorize(['admin']), clientController.getClientProfile);
router.put('/profile', clientController.updateClientProfile);
router.delete('/account', clientController.deleteAccount);

// 📊 Statistiques et activité
router.get('/stats', clientController.getClientStats);
router.get('/activity', clientController.getActivityHistory);

// 🔍 Recherche et découverte
router.get('/search', clientController.searchProviders);
router.get('/recommendations', clientController.getRecommendations);
router.get('/recommendations/:id', authorize(['admin']), clientController.getRecommendations);

// 👁️ Interactions
router.post('/track-view', clientController.trackProfileView);
router.post('/contact', clientController.contactProvider);

// ⭐ Favoris
router.get('/favorites', clientController.getFavorites);
router.post('/favorites', clientController.addToFavorites);
router.delete('/favorites/:providerId', clientController.removeFromFavorites);

// 🔔 Notifications
router.get('/notifications', clientController.getNotifications);
router.put('/notifications/:notificationId/read', clientController.markNotificationAsRead);

// ⚙️ Préférences et abonnement
router.put('/preferences', clientController.updatePreferences);
router.put('/subscription', clientController.updateSubscription);

module.exports = router;