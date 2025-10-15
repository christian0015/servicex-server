const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middlewares/auth');

// 🔄 Synchronisation
router.post('/sync/profile-view', authenticate, analyticsController.trackProfileView);
router.post('/sync/contact', authenticate, analyticsController.trackContact);

// 🏆 Classements
router.get('/rankings', analyticsController.getRankings);
router.post('/rankings/update', analyticsController.updateRankings);

// 📈 Statistiques
router.get('/stats/provider/:id', analyticsController.getProviderStats);
router.get('/stats/client/:id', analyticsController.getClientStats);
router.get('/stats/platform', analyticsController.getPlatformStats);

// 🧠 Recommandations
router.get('/recommendations/trending', analyticsController.getTrendingRecommendations);
router.get('/recommendations/:clientId', analyticsController.getRecommendations);

// 🧠 Recommandations - CORRECTION : mettre trending avant :clientId
router.get('/recommendations/trending', analyticsController.getTrendingRecommendations);
router.get('/recommendations/:clientId', analyticsController.getRecommendations);

module.exports = router;