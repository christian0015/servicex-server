const cron = require('node-cron');
const rankingService = require('../analytics/rankingService');

class CronJobs {
  init() {
    // Tous les lundis à 2h du matin
    cron.schedule('0 2 * * 1', async () => {
      console.log('🕒 Exécution du classement hebdomadaire...');
      await rankingService.runWeeklyRankingJob();
    });

    // Tous les jours à minuit pour le reset des quotas
    cron.schedule('0 0 * * *', async () => {
      console.log('🕒 Reset des quotas quotidiens...');
      // Implémentation du reset
    });

    console.log('✅ Jobs cron initialisés');
  }
}

module.exports = new CronJobs();