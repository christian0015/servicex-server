
const ServiceProvider = require('../../models/serviceProvider.model');

class RankingService {
  /**
   * Configuration des badges disponibles
   */
  get BADGES_CONFIG() {
    return {
      'response_rapide': {
        condition: (provider) => provider.getAverageResponseTime && provider.getAverageResponseTime() < 30,
        levels: { bronze: 10, silver: 50, gold: 100 }
      },
      'fiable': {
        condition: (provider) => provider.rating.average >= 4.5,
        levels: { bronze: 5, silver: 25, gold: 100 }
      },
      'top_note': {
        condition: (provider) => provider.rating.average >= 4.8,
        levels: { bronze: 10, silver: 30, gold: 50 }
      },
      'super_dispo': {
        condition: (provider) => this.calculateAvailabilityScore(provider) > 0.8,
        levels: { bronze: 1, silver: 2, gold: 4 }
      },
      'populaire': {
        condition: (provider) => provider.profileStats.totalViews > 100,
        levels: { bronze: 100, silver: 500, gold: 1000 }
      }
    };
  }

  /**
   * Met à jour tous les classements
   */
  async updateAllRankings() {
    try {
      console.log('🔄 Début de la mise à jour des classements...');
      
      await this.updateWeeklyRankings();
      await this.updateCategoryRankings();
      await this.updateBadges();
      await this.rewardTopPerformers();
      
      console.log('✅ Tous les classements mis à jour');
      return { success: true, message: 'Classements mis à jour avec succès' };
      
    } catch (error) {
      console.error('❌ Erreur mise à jour classements:', error);
      // Ne pas bloquer le démarrage de l'application
      return { success: false, message: 'Erreur classements mais application démarrée' };
    }
  }

  /**
   * Classement hebdomadaire général - CORRECTION
   */
  async updateWeeklyRankings() {
    try {
      // Récupérer tous les prestataires actifs
      const providers = await ServiceProvider.find({ isActive: true })
        .select('rating profileStats contactCount gamification createdAt services')
        .lean();

      // Calculer le score pour chaque prestataire
      const providersWithScores = providers.map(provider => {
        const performanceScore = this.calculatePerformanceScore(provider);
        const engagementScore = this.calculateEngagementScore(provider);
        const totalScore = performanceScore + engagementScore;

        return {
          ...provider,
          performanceScore,
          engagementScore,
          totalScore
        };
      });

      // Trier par score total
      providersWithScores.sort((a, b) => b.totalScore - a.totalScore);

      // Mise à jour des classements
      const updatePromises = providersWithScores.map(async (provider, index) => {
        const weeklyPoints = Math.floor(provider.totalScore);
        const currentTotal = provider.gamification?.points?.total || 0;
        const newTotal = currentTotal + weeklyPoints;

        return ServiceProvider.findByIdAndUpdate(
          provider._id,
          {
            $set: {
              'gamification.ranking.weekly': index + 1,
              'gamification.points.weekly': weeklyPoints,
              'gamification.points.total': newTotal
            }
          },
          { new: true }
        );
      });

      await Promise.all(updatePromises);
      console.log(`✅ Classement hebdomadaire mis à jour pour ${providersWithScores.length} prestataires`);
      
    } catch (error) {
      console.error('❌ Erreur classement hebdomadaire:', error);
      throw error;
    }
  }

  /**
   * Calcule le score de performance
   */
  calculatePerformanceScore(provider) {
    let score = 0;
    
    // Note sur 100 (5*20)
    score += (provider.rating?.average || 0) * 20;
    
    // Visites (0.01 point par vue)
    score += (provider.profileStats?.totalViews || 0) * 0.01;
    
    // Contacts (0.1 point par contact)
    score += (provider.contactCount || 0) * 0.1;
    
    // Badges (2 points par badge)
    score += (provider.gamification?.badges?.length || 0) * 2;
    
    // Ancienneté/consistance
    const weeksActive = provider.profileStats?.weeklyViews?.length || 0;
    score += (weeksActive / 52) * 10;
    
    return score;
  }

  /**
   * Calcule le score d'engagement
   */
  calculateEngagementScore(provider) {
    if (!provider.contactCount || provider.contactCount === 0) return 0;
    
    const reviewCount = provider.rating?.reviews?.length || 0;
    const engagementRate = reviewCount / provider.contactCount;
    
    return Math.min(engagementRate * 100, 50); // Max 50 points pour l'engagement
  }

  /**
   * Classement par catégorie de service
   */
  async updateCategoryRankings() {
    try {
      const categories = await ServiceProvider.distinct('services.label');
      
      for (const category of categories) {
        const providersInCategory = await ServiceProvider.find({
          'services.label': category,
          isActive: true
        }).sort({ 'gamification.points.total': -1 });

        const updatePromises = providersInCategory.map((provider, index) => {
          return ServiceProvider.findByIdAndUpdate(
            provider._id,
            {
              'gamification.ranking.category': index + 1
            }
          );
        });

        await Promise.all(updatePromises);
        console.log(`✅ Classement ${category} mis à jour (${providersInCategory.length} prestataires)`);
      }
      
    } catch (error) {
      console.error('❌ Erreur classement par catégorie:', error);
      throw error;
    }
  }

  /**
   * Met à jour les badges de tous les prestataires
   */
  async updateBadges() {
    try {
      const providers = await ServiceProvider.find({ isActive: true });
      let totalBadges = 0;

      for (const provider of providers) {
        const newBadges = await this.calculateBadgesForProvider(provider);
        totalBadges += newBadges.length;
        
        if (newBadges.length > 0) {
          await ServiceProvider.findByIdAndUpdate(provider._id, {
            'gamification.badges': newBadges
          });
        }
      }

      console.log(`✅ ${totalBadges} badges attribués à ${providers.length} prestataires`);
      
    } catch (error) {
      console.error('❌ Erreur mise à jour badges:', error);
      throw error;
    }
  }

  /**
   * Calcule les badges pour un prestataire spécifique
   */
  async calculateBadgesForProvider(provider) {
    const newBadges = [];

    for (const [badgeName, config] of Object.entries(this.BADGES_CONFIG)) {
      if (config.condition(provider)) {
        const currentCount = provider.getBadgeProgress ? provider.getBadgeProgress(badgeName) : 0;
        const level = this.determineBadgeLevel(currentCount, config.levels);

        newBadges.push({
          name: badgeName,
          type: this.getBadgeType(badgeName),
          level: level,
          earnedAt: new Date(),
          progress: currentCount
        });
      }
    }

    return newBadges;
  }

  /**
   * Calcule le score de disponibilité
   */
  calculateAvailabilityScore(provider) {
    if (!provider.availability || provider.availability.length === 0) return 0;
    
    const totalDays = 7;
    const availableDays = provider.availability.length;
    return availableDays / totalDays;
  }

  /**
   * Détermine le niveau d'un badge
   */
  determineBadgeLevel(currentCount, levels) {
    if (currentCount >= levels.gold) return 'gold';
    if (currentCount >= levels.silver) return 'silver';
    return 'bronze';
  }

  /**
   * Détermine le type de badge
   */
  getBadgeType(badgeName) {
    const typeMap = {
      'response_rapide': 'speed',
      'fiable': 'reliability', 
      'top_note': 'quality',
      'super_dispo': 'availability',
      'populaire': 'popularity'
    };
    
    return typeMap[badgeName] || 'performance';
  }

  /**
   * Récompense les meilleurs performeurs
   */
  async rewardTopPerformers() {
    try {
      const topProviders = await ServiceProvider.find({
        'gamification.ranking.weekly': { $lte: 10 }
      }).sort({ 'gamification.ranking.weekly': 1 });

      const rewardPromises = topProviders.map(async (provider, index) => {
        const boostMultiplier = this.getBoostMultiplier(index + 1);
        
        return ServiceProvider.findByIdAndUpdate(
          provider._id,
          { 
            $set: { 
              'profileStats.weeklyBoost': boostMultiplier
            }
          }
        );
      });

      await Promise.all(rewardPromises);
      console.log(`✅ ${topProviders.length} top performeurs récompensés`);
      
    } catch (error) {
      console.error('❌ Erreur récompenses:', error);
      throw error;
    }
  }

  /**
   * Calcule le multiplicateur de boost selon le rang
   */
  getBoostMultiplier(ranking) {
    const boostMap = {
      1: 2.0, // +100% pour le 1er
      2: 1.8, // +80% pour le 2ème
      3: 1.6, // +60% pour le 3ème
      4: 1.5, // +50% pour le 4ème
      5: 1.4, // +40% pour le 5ème
    };
    
    return boostMap[ranking] || 1.2; // +20% pour les autres top 10
  }

  /**
   * Récupère le classement pour l'affichage
   */
  async getRankings(options = {}) {
    const { category, limit = 50, type = 'weekly' } = options;
    
    try {
      const query = { isActive: true };
      if (category) query['services.label'] = category;

      const sortField = type === 'weekly' ? 'gamification.ranking.weekly' : 'gamification.ranking.category';

      const rankings = await ServiceProvider.find(query)
        .sort({ [sortField]: 1 })
        .limit(parseInt(limit))
        .select('fullName profilePhoto rating services gamification profileStats contactCount')
        .lean();

      return rankings.map(provider => ({
        ...provider,
        performance: {
          score: provider.gamification.points?.weekly || 0,
          ranking: provider.gamification.ranking?.[type] || 0,
          badges: provider.gamification.badges?.length || 0
        },
        stats: {
          views: provider.profileStats?.totalViews || 0,
          contacts: provider.contactCount || 0,
          rating: provider.rating?.average || 0
        }
      }));
      
    } catch (error) {
      console.error('❌ Erreur récupération classements:', error);
      throw error;
    }
  }
}

module.exports = new RankingService();