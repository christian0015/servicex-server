const ServiceProvider = require('../../models/serviceProvider.model');
const Client = require('../../models/client.model');

class StatsService {
  /**
   * Récupère les statistiques complètes d'un prestataire
   */
  async getProviderStats(providerId) {
    try {
      const provider = await ServiceProvider.findById(providerId)
        .select('profileStats rating contactCount gamification services availability createdAt');
      
      if (!provider) {
        throw new Error('Prestataire non trouvé');
      }

      // 📊 Calcul des métriques avancées
      const advancedStats = await this.calculateAdvancedProviderStats(provider);
      
      return {
        basic: {
          totalViews: provider.profileStats?.totalViews || 0,
          contactCount: provider.contactCount || 0,
          averageRating: provider.rating?.average || 0,
          totalReviews: provider.rating?.totalVotes || 0,
          memberSince: provider.createdAt
        },
        weekly: {
          currentWeekViews: this.getCurrentWeekViews(provider),
          weeklyGrowth: this.calculateWeeklyGrowth(provider),
          bestWeek: provider.profileStats?.bestWeek || null
        },
        engagement: {
          responseRate: await this.calculateResponseRate(providerId),
          profileCompletion: this.calculateProfileCompletion(provider),
          availabilityScore: this.calculateAvailabilityScore(provider)
        },
        advanced: advancedStats,
        ranking: provider.gamification?.ranking || {},
        badges: provider.gamification?.badges || []
      };
      
    } catch (error) {
      console.error('❌ Erreur stats prestataire:', error);
      throw error;
    }
  }

  /**
   * Statistiques globales de la plateforme
   */
  async getPlatformStats() {
    try {
      const [
        totalProviders,
        totalClients,
        activeProviders,
        totalContacts,
        recentRegistrations
      ] = await Promise.all([
        ServiceProvider.countDocuments(),
        Client.countDocuments(),
        ServiceProvider.countDocuments({ isActive: true }),
        ServiceProvider.aggregate([{ $group: { _id: null, total: { $sum: '$contactCount' } } }]),
        ServiceProvider.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
      ]);

      // 📈 Top catégories
      const topCategories = await ServiceProvider.aggregate([
        { $unwind: '$services' },
        { $group: { _id: '$services.label', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      // 🏆 Top prestataires
      const topProviders = await ServiceProvider.find({ isActive: true })
        .sort({ 'rating.average': -1, 'profileStats.totalViews': -1 })
        .limit(5)
        .select('fullName profilePhoto rating services');

      return {
        overview: {
          totalProviders,
          totalClients,
          activeProviders,
          totalContacts: totalContacts[0]?.total || 0,
          newRegistrations: recentRegistrations
        },
        categories: topCategories,
        topPerformers: topProviders,
        platformHealth: {
          providerActivationRate: (activeProviders / totalProviders * 100).toFixed(1),
          avgRating: await this.getPlatformAverageRating(),
          contactPerProvider: totalContacts[0]?.total / totalProviders || 0
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur stats plateforme:', error);
      throw error;
    }
  }

  /**
   * Statistiques d'utilisation client
   */
  async getClientStats(clientId) {
    try {
      const client = await Client.findById(clientId)
        .select('activity favorites searchHistory subscription createdAt');
      
      if (!client) {
        throw new Error('Client non trouvé');
      }

      const recentActivity = await this.getRecentClientActivity(clientId);
      
      return {
        usage: {
          totalSearches: client.searchHistory?.length || 0,
          totalContacts: client.activity?.stats?.totalContacts || 0,
          totalProfileViews: client.activity?.stats?.totalViews || 0,
          favoriteCount: client.favorites?.length || 0,
          memberSince: client.createdAt
        },
        recent: recentActivity,
        preferences: {
          mostSearched: this.getMostSearchedTerms(client),
          favoriteCategories: this.getFavoriteCategories(client),
          contactPatterns: await this.getContactPatterns(clientId)
        },
        subscription: client.subscription
      };
      
    } catch (error) {
      console.error('❌ Erreur stats client:', error);
      throw error;
    }
  }

  /**
   * Calcule les stats avancées d'un prestataire
   */
  async calculateAdvancedProviderStats(provider) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 📈 Trends des 30 derniers jours
    const recentViews = provider.profileStats?.recentViews?.filter(
      view => new Date(view.viewedAt) >= thirtyDaysAgo
    ).length || 0;

    // 🎯 Taux de conversion
    const conversionRate = provider.contactCount > 0 && provider.profileStats?.totalViews > 0 
      ? (provider.contactCount / provider.profileStats.totalViews * 100).toFixed(1)
      : 0;

    // 📅 Analyse de disponibilité
    const availabilityAnalysis = this.analyzeAvailability(provider.availability);

    return {
      recentViews30Days: recentViews,
      conversionRate: `${conversionRate}%`,
      availability: availabilityAnalysis,
      responseTime: await this.calculateAverageResponseTime(provider._id),
      clientRetention: await this.calculateClientRetention(provider._id)
    };
  }


  //***************** Debut new function ************************************ */ 
  /**
   * Calcule le score de disponibilité (méthode manquante)
   */
  calculateAvailabilityScore(provider) {
    if (!provider.availability || provider.availability.length === 0) return 0;
    
    const totalDays = 7;
    const availableDays = provider.availability.length;
    const baseScore = availableDays / totalDays;
    
    // Bonus pour les créneaux étendus
    let timeBonus = 0;
    provider.availability.forEach(day => {
      day.timeSlots.forEach(slot => {
        const fromMinutes = this.timeToMinutes(slot.from);
        const toMinutes = this.timeToMinutes(slot.to);
        const duration = toMinutes - fromMinutes;
        
        if (duration > 240) timeBonus += 0.1; // +0.1 pour créneaux > 4h
      });
    });
    
    return Math.min(1, baseScore + timeBonus);
  }

  /**
   * Convertit le temps en minutes (méthode utilitaire)
   */
  timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }
  //***************** fin new function ************************************ */ 




  /**
   * Analyse la disponibilité d'un prestataire
   */
  analyzeAvailability(availability) {
    if (!availability || availability.length === 0) {
      return { score: 0, peakDays: [], recommendation: 'Ajoutez vos disponibilités' };
    }

    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const dayCount = availability.length;
    const score = (dayCount / 7) * 100;

    // 📊 Jours les plus populaires
    const peakDays = availability
      .map(a => a.day)
      .sort((a, b) => days.indexOf(a) - days.indexOf(b));

    let recommendation = 'Disponibilité excellente';
    if (score < 30) recommendation = 'Envisagez d\'ajouter plus de créneaux';
    else if (score < 70) recommendation = 'Bonne disponibilité';

    return { score, peakDays, recommendation };
  }

  /**
   * Calcule le taux de réponse moyen
   */
  async calculateResponseRate(providerId) {
    // 🕒 Simulons un calcul de taux de réponse
    // En production, on utiliserait les données de messagerie
    const provider = await ServiceProvider.findById(providerId)
      .select('rating contactCount');
    
    if (!provider || provider.contactCount === 0) return '0%';
    
    // Simulation basée sur les notes et contacts
    const baseRate = Math.min(95, 70 + (provider.rating.average * 5));
    return `${baseRate}%`;
  }

  /**
   * Calcule le temps de réponse moyen
   */
  async calculateAverageResponseTime(providerId) {
    // ⏱️ Simulation - en production, utiliser les timestamps des messages
    const provider = await ServiceProvider.findById(providerId)
      .select('rating');
    
    if (!provider) return 'N/A';
    
    // Simulation basée sur la note
    if (provider.rating.average >= 4.5) return 'Moins de 1h';
    if (provider.rating.average >= 4.0) return '1-4h';
    if (provider.rating.average >= 3.0) return '4-12h';
    return '12h+';
  }

  /**
   * Calcule la rétention client
   */
  async calculateClientRetention(providerId) {
    // 🔄 Simulation - en production, analyser les clients récurrents
    const provider = await ServiceProvider.findById(providerId)
      .select('contactCount rating');
    
    if (!provider || provider.contactCount < 5) return 'Nouveau';
    
    // Simulation basée sur la note et le nombre de contacts
    const retentionScore = provider.rating.average * 20 + Math.min(provider.contactCount * 2, 40);
    
    if (retentionScore >= 90) return 'Excellente';
    if (retentionScore >= 70) return 'Bonne';
    if (retentionScore >= 50) return 'Moyenne';
    return 'À améliorer';
  }

  /**
   * Récupère l'activité récente d'un client
   */
  async getRecentClientActivity(clientId) {
    const client = await Client.findById(clientId)
      .populate('activity.profilesViewed.providerId', 'fullName services')
      .populate('activity.contactsMade.providerId', 'fullName services');
    
    if (!client) return { views: [], contacts: [] };

    const recentViews = client.activity.profilesViewed
      .slice(0, 10)
      .map(view => ({
        provider: view.providerId?.fullName,
        service: view.providerId?.services[0]?.label,
        viewedAt: view.viewedAt,
        duration: view.duration
      }));

    const recentContacts = client.activity.contactsMade
      .slice(0, 10)
      .map(contact => ({
        provider: contact.providerId?.fullName,
        service: contact.serviceType,
        contactDate: contact.contactDate,
        status: contact.status
      }));

    return { views: recentViews, contacts: recentContacts };
  }

  /**
   * Termes les plus recherchés par un client
   */
  getMostSearchedTerms(client) {
    if (!client.searchHistory || client.searchHistory.length === 0) return [];
    
    const termCount = {};
    client.searchHistory.forEach(search => {
      if (search.query) {
        termCount[search.query] = (termCount[search.query] || 0) + 1;
      }
    });
    
    return Object.entries(termCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([term, count]) => ({ term, count }));
  }

  /**
   * Catégories préférées d'un client
   */
  getFavoriteCategories(client) {
    if (!client.favorites || client.favorites.length === 0) return [];
    
    const categoryCount = {};
    client.favorites.forEach(fav => {
      if (fav.providerId?.services) {
        fav.providerId.services.forEach(service => {
          categoryCount[service.label] = (categoryCount[service.label] || 0) + 1;
        });
      }
    });
    
    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));
  }

  /**
   * Patterns de contact d'un client
   */
  async getContactPatterns(clientId) {
    const client = await Client.findById(clientId)
      .select('activity.contactsMade');
    
    if (!client || !client.activity.contactsMade) {
      return { preferredDays: [], preferredServices: [] };
    }

    const dayCount = {};
    const serviceCount = {};
    
    client.activity.contactsMade.forEach(contact => {
      // Jour de la semaine
      const day = new Date(contact.contactDate).toLocaleDateString('fr-FR', { weekday: 'long' });
      dayCount[day] = (dayCount[day] || 0) + 1;
      
      // Service
      if (contact.serviceType) {
        serviceCount[contact.serviceType] = (serviceCount[contact.serviceType] || 0) + 1;
      }
    });

    return {
      preferredDays: Object.entries(dayCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([day, count]) => ({ day, count })),
      preferredServices: Object.entries(serviceCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([service, count]) => ({ service, count }))
    };
  }

  /**
   * Vues de la semaine actuelle
   */
  getCurrentWeekViews(provider) {
    if (!provider.profileStats?.weeklyViews) return 0;
    
    const currentWeekStart = this.getWeekStart(new Date());
    const currentWeek = provider.profileStats.weeklyViews.find(
      week => week.weekStart.getTime() === currentWeekStart.getTime()
    );
    
    return currentWeek?.viewCount || 0;
  }

  /**
   * Croissance hebdomadaire
   */
  calculateWeeklyGrowth(provider) {
    if (!provider.profileStats?.weeklyViews || provider.profileStats.weeklyViews.length < 2) {
      return 0;
    }
    
    const weeks = [...provider.profileStats.weeklyViews].sort((a, b) => 
      b.weekStart - a.weekStart
    );
    
    if (weeks.length < 2) return 0;
    
    const currentWeek = weeks[0].viewCount;
    const previousWeek = weeks[1].viewCount;
    
    if (previousWeek === 0) return currentWeek > 0 ? 100 : 0;
    
    return ((currentWeek - previousWeek) / previousWeek * 100).toFixed(1);
  }

  /**
   * Note moyenne de la plateforme
   */
  async getPlatformAverageRating() {
    const result = await ServiceProvider.aggregate([
      { $match: { 'rating.average': { $gt: 0 } } },
      { $group: { _id: null, avgRating: { $avg: '$rating.average' } } }
    ]);
    
    return result[0]?.avgRating?.toFixed(1) || '0.0';
  }

  /**
   * Taux de complétion de profil
   */
  calculateProfileCompletion(provider) {
    const fields = [
      provider.fullName,
      provider.profilePhoto,
      provider.description,
      provider.services?.length > 0,
      provider.availability?.length > 0,
      provider.zones?.length > 0
    ];
    
    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  }

  /**
   * Début de semaine (lundi)
   */
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}

module.exports = new StatsService();