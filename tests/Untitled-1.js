const syncService = require('../services/analytics/syncService');
const rankingService = require('../services/analytics/rankingService');

class AnalyticsController {
  /**
   * Track une vue de profil
   */
  async trackProfileView(req, res) {
    try {
      const { providerId, duration = 0 } = req.body;
      const clientId = req.user.id; // From auth middleware

      const result = await syncService.trackProfileView(clientId, providerId, duration);
      
      res.json({
        success: true,
        message: 'Vue trackée avec succès',
        data: result
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Déclenche manuellement le classement
   */
  async triggerRankingUpdate(req, res) {
    try {
      const result = await rankingService.runWeeklyRankingJob();
      
      res.json({
        success: true,
        message: 'Classement mis à jour',
        data: result
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Récupère les classements
   */
  async getRankings(req, res) {
    try {
      const { category, limit = 20 } = req.query;
      
      const query = { isActive: true };
      if (category) query['services.label'] = category;

      const rankings = await ServiceProvider.find(query)
        .sort({ 'gamification.ranking.weekly': 1 })
        .limit(parseInt(limit))
        .select('fullName profilePhoto rating services gamification profileStats');

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
}

module.exports = new AnalyticsController();