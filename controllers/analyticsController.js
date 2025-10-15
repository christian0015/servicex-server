const syncService = require('../services/analytics/syncService');
const rankingService = require('../services/analytics/rankingService');
const statsService = require('../services/analytics/statsService');
const recommendationService = require('../services/analytics/recommendationService');

class AnalyticsController {
  // 🔄 Synchronisation
  async trackProfileView(req, res) {
    try {
      // console.log('🔐 User object:', req.user); // AJOUT POUR DEBUG
      const { providerId, duration = 0 } = req.body;
      const clientId = req.user.id; // From auth middleware

      const result = await syncService.trackProfileView(clientId, providerId, duration);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async trackContact(req, res) {
    try {
      console.log('🔐 User object:', req.user); // AJOUT POUR DEBUG
      const { providerId, serviceType } = req.body;
      const clientId = req.user.id;

      const result = await syncService.trackContact(clientId, providerId, serviceType);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // 🏆 Classements
  async getRankings(req, res) {
    try {
      const { category, limit, type } = req.query;
      
      const rankings = await rankingService.getRankings({
        category,
        limit: parseInt(limit) || 50,
        type: type || 'weekly'
      });
      
      res.json({
        success: true,
        data: rankings
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async updateRankings(req, res) {
    try {
      const result = await rankingService.updateAllRankings();
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // 📈 Statistiques
  async getProviderStats(req, res) {
    try {
      const stats = await statsService.getProviderStats(req.params.id);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getClientStats(req, res) {
    try {
      const stats = await statsService.getClientStats(req.params.id);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getPlatformStats(req, res) {
    try {
      const stats = await statsService.getPlatformStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // 🧠 Recommandations
  async getRecommendations(req, res) {
    try {
      const { limit, includeExplanation, type } = req.query;
      
      let result;
      if (type === 'collaborative') {
        result = await recommendationService.getCollaborativeRecommendations(
          req.params.clientId, 
          parseInt(limit) || 10
        );
      } else {
        result = await recommendationService.getPersonalizedRecommendations(
          req.params.clientId, 
          {
            limit: parseInt(limit) || 10,
            includeExplanation: includeExplanation === 'true'
          }
        );
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getTrendingRecommendations(req, res) {
    try {
      const { limit } = req.query;
      
      const result = await recommendationService.getTrendingRecommendations(
        parseInt(limit) || 10
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AnalyticsController();