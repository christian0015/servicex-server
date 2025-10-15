const Client = require('../../models/client.model');
const ServiceProvider = require('../../models/serviceProvider.model');

class RecommendationService {
  /**
   * Génère des recommandations personnalisées pour un client
   */
  // async getPersonalizedRecommendations(clientId, options = {}) {
  //   try {
  //     const { limit = 10, includeExplanation = false } = options;
      
  //     const client = await Client.findById(clientId)
  //       .populate('activity.profilesViewed.providerId')
  //       .populate('activity.contactsMade.providerId')
  //       .populate('favorites.providerId');
      
  //     if (!client) {
  //       throw new Error('Client non trouvé');
  //     }

  //     // 🎯 Récupération des préférences du client
  //     const clientPreferences = await this.analyzeClientPreferences(client);
      
  //     // 🔍 Construction de la query de recherche
  //     const searchQuery = this.buildRecommendationQuery(clientPreferences);
      
  //     // 📊 Récupération des prestataires correspondants
  //     let providers = await ServiceProvider.find(searchQuery)
  //       .limit(limit * 2) // On prend plus pour filtrer après
  //       .select('fullName profilePhoto rating services availability zones profileStats gamification description');
      
  //     // 🧮 Scoring et tri des résultats
  //     const scoredProviders = providers.map(provider => 
  //       this.scoreProvider(provider, clientPreferences, client)
  //     );
      
  //     // 🏆 Tri par score et limite
  //     const topProviders = scoredProviders
  //       .sort((a, b) => b.score - a.score)
  //       .slice(0, limit);
      
  //     // 📝 Génération des explications si demandé
  //     if (includeExplanation) {
  //       topProviders.forEach(provider => {
  //         provider.explanation = this.generateExplanation(provider, clientPreferences);
  //       });
  //     }
      
  //     return {
  //       success: true,
  //       data: topProviders,
  //       metadata: {
  //         totalProviders: providers.length,
  //         clientPreferences: includeExplanation ? clientPreferences : undefined,
  //         generatedAt: new Date()
  //       }
  //     };
      
  //   } catch (error) {
  //     console.error('❌ Erreur recommandations:', error);
  //     throw error;
  //   }
  // }
  
  // Remplacer la logique complexe par un appel à la méthode du modèle :
  async getPersonalizedRecommendations(clientId, options = {}) {
    try {
      const client = await Client.findById(clientId);
      if (!client) throw new Error('Client non trouvé');

      // Utiliser la méthode du modèle qui contient toute la logique
      const recommendations = await client.generateRecommendations(options.limit);
      
      return {
        success: true,
        data: recommendations,
        metadata: {
          totalProviders: recommendations.length,
          generatedAt: new Date()
        }
      };
    } catch (error) {
      console.error('❌ Erreur recommandations:', error);
      throw error;
    }
  }

  /**
   * Analyse les préférences d'un client basé sur son historique
   */
  async analyzeClientPreferences(client) {
    const preferences = {
      // 🎯 Services les plus recherchés
      preferredServices: this.extractPreferredServices(client),
      
      // 📍 Zones préférées
      preferredZones: this.extractPreferredZones(client),
      
      // ⭐ Critères de qualité
      qualityPreferences: this.extractQualityPreferences(client),
      
      // 🕒 Préférences horaires
      timePreferences: this.extractTimePreferences(client),
      
      // 💰 Preferences budgétaires
      budgetPreferences: this.extractBudgetPreferences(client),
      
      // 🔄 Comportement d'engagement
      engagementPatterns: this.analyzeEngagementPatterns(client)
    };
    
    return preferences;
  }

  /**
   * Extrait les services préférés du client
   */
  extractPreferredServices(client) {
    const serviceCount = {};
    
    // Depuis l'historique de recherche
    client.searchHistory?.forEach(search => {
      if (search.query) {
        const services = this.extractServicesFromQuery(search.query);
        services.forEach(service => {
          serviceCount[service] = (serviceCount[service] || 0) + 1;
        });
      }
    });
    
    // Depuis les contacts établis
    client.activity.contactsMade?.forEach(contact => {
      if (contact.serviceType) {
        serviceCount[contact.serviceType] = (serviceCount[contact.serviceType] || 0) + 2; // Poids plus important
      }
    });
    
    // Depuis les favoris
    client.favorites?.forEach(favorite => {
      if (favorite.providerId?.services) {
        favorite.providerId.services.forEach(service => {
          serviceCount[service.label] = (serviceCount[service.label] || 0) + 1.5;
        });
      }
    });
    
    return Object.entries(serviceCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([service]) => service);
  }

  /**
   * Extrait les zones préférées
   */
  extractPreferredZones(client) {
    const zoneCount = {};
    
    // Depuis les profils consultés
    client.activity.profilesViewed?.forEach(view => {
      if (view.providerId?.zones) {
        view.providerId.zones.forEach(zone => {
          zoneCount[zone] = (zoneCount[zone] || 0) + 1;
        });
      }
    });
    
    // Depuis les contacts
    client.activity.contactsMade?.forEach(contact => {
      if (contact.providerId?.zones) {
        contact.providerId.zones.forEach(zone => {
          zoneCount[zone] = (zoneCount[zone] || 0) + 2;
        });
      }
    });
    
    // Zones du client
    if (client.preferences?.preferredZones) {
      client.preferences.preferredZones.forEach(zone => {
        zoneCount[zone] = (zoneCount[zone] || 0) + 3;
      });
    }
    
    return Object.entries(zoneCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([zone]) => zone);
  }

  /**
   * Extrait les préférences de qualité
   */
  extractQualityPreferences(client) {
    const preferences = {
      minRating: 3.0,
      requireVerification: false,
      minExperience: 0
    };
    
    // Analyse des prestataires contactés
    const contactedProviders = client.activity.contactsMade
      ?.map(contact => contact.providerId)
      .filter(Boolean);
    
    if (contactedProviders && contactedProviders.length > 0) {
      const avgRating = contactedProviders.reduce((sum, provider) => 
        sum + (provider.rating?.average || 0), 0
      ) / contactedProviders.length;
      
      preferences.minRating = Math.max(3.0, avgRating - 0.5);
      preferences.requireVerification = contactedProviders.some(p => p.whatsappVerified);
    }
    
    return preferences;
  }

  /**
   * Extrait les préférences horaires
   */
  extractTimePreferences(client) {
    const timeSlots = {};
    
    client.activity.contactsMade?.forEach(contact => {
      const hour = new Date(contact.contactDate).getHours();
      const timeSlot = this.getTimeSlot(hour);
      timeSlots[timeSlot] = (timeSlots[timeSlot] || 0) + 1;
    });
    
    return {
      preferredSlots: Object.entries(timeSlots)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .map(([slot]) => slot),
      preferredDays: this.extractPreferredDays(client)
    };
  }

  /**
   * Extrait les préférences budgétaires
   */
  extractBudgetPreferences(client) {
    // 🎯 En production, on analyserait les prix des services contactés
    // Pour l'instant, on utilise les préférences du client si définies
    return client.preferences?.budgetRange || {
      min: 0,
      max: 10000
    };
  }

  /**
   * Analyse les patterns d'engagement
   */
  analyzeEngagementPatterns(client) {
    const patterns = {
      responsivenessImportance: 0.5,
      profileCompletenessImportance: 0.3,
      popularityImportance: 0.2
    };
    
    // Clients qui contactent rapidement après visualisation = importance réactivité
    const quickContacts = client.activity.profilesViewed?.filter(view => {
      const contact = client.activity.contactsMade?.find(c => 
        c.providerId?.toString() === view.providerId?.toString() &&
        new Date(c.contactDate) - new Date(view.viewedAt) < 3600000 // 1 heure
      );
      return contact !== undefined;
    }).length || 0;
    
    if (quickContacts > 0) {
      patterns.responsivenessImportance = Math.min(0.8, 0.5 + (quickContacts * 0.1));
    }
    
    return patterns;
  }

  /**
   * Construit la query de recherche pour les recommandations
   */
  buildRecommendationQuery(preferences) {
    const query = {
      isActive: true,
      whatsappVerified: preferences.qualityPreferences.requireVerification || false,
      'rating.average': { $gte: preferences.qualityPreferences.minRating }
    };
    
    // Filtre par services
    if (preferences.preferredServices.length > 0) {
      query['services.label'] = { $in: preferences.preferredServices };
    }
    
    // Filtre par zones
    if (preferences.preferredZones.length > 0) {
      query['zones'] = { $in: preferences.preferredZones };
    }
    
    return query;
  }

  /**
   * Score un prestataire selon les préférences du client
   */
  scoreProvider(provider, preferences, client) {
    let score = 0;
    const maxScores = {
      serviceMatch: 30,
      zoneMatch: 20,
      quality: 25,
      availability: 15,
      engagement: 10
    };
    
    // 🎯 Correspondance des services
    const serviceMatch = this.calculateServiceMatch(provider, preferences.preferredServices);
    score += serviceMatch * maxScores.serviceMatch;
    
    // 📍 Correspondance des zones
    const zoneMatch = this.calculateZoneMatch(provider, preferences.preferredZones);
    score += zoneMatch * maxScores.zoneMatch;
    
    // ⭐ Qualité et fiabilité
    const qualityScore = this.calculateQualityScore(provider, preferences.qualityPreferences);
    score += qualityScore * maxScores.quality;
    
    // 🕒 Disponibilité
    const availabilityScore = this.calculateAvailabilityScore(provider, preferences.timePreferences);
    score += availabilityScore * maxScores.availability;
    
    // 🔄 Engagement et performance
    const engagementScore = this.calculateEngagementScore(provider, preferences.engagementPatterns);
    score += engagementScore * maxScores.engagement;
    
    // 🚀 Boost pour les nouveaux (découverte)
    if (!this.hasInteractedWithProvider(client, provider._id)) {
      score += 5;
    }
    
    return {
      provider: {
        _id: provider._id,
        fullName: provider.fullName,
        profilePhoto: provider.profilePhoto,
        rating: provider.rating,
        services: provider.services,
        zones: provider.zones,
        description: provider.description,
        profileStats: provider.profileStats,
        gamification: provider.gamification
      },
      score: Math.round(score),
      breakdown: {
        serviceMatch: Math.round(serviceMatch * maxScores.serviceMatch),
        zoneMatch: Math.round(zoneMatch * maxScores.zoneMatch),
        quality: Math.round(qualityScore * maxScores.quality),
        availability: Math.round(availabilityScore * maxScores.availability),
        engagement: Math.round(engagementScore * maxScores.engagement)
      }
    };
  }

  /**
   * Calcule la correspondance des services
   */
  calculateServiceMatch(provider, preferredServices) {
    if (preferredServices.length === 0) return 0.5; // Score neutre
    
    const providerServices = provider.services.map(s => s.label);
    const matches = preferredServices.filter(service => 
      providerServices.includes(service)
    );
    
    return matches.length / preferredServices.length;
  }

  /**
   * Calcule la correspondance des zones
   */
  calculateZoneMatch(provider, preferredZones) {
    if (preferredZones.length === 0) return 0.5;
    
    const matches = preferredZones.filter(zone => 
      provider.zones.includes(zone)
    );
    
    return matches.length / preferredZones.length;
  }

  /**
   * Calcule le score de qualité
   */
  calculateQualityScore(provider, qualityPreferences) {
    let score = 0;
    
    // Note moyenne (40% du score qualité)
    const ratingScore = Math.min(1, provider.rating.average / 5);
    score += ratingScore * 0.4;
    
    // Nombre d'avis (30%)
    const reviewCountScore = Math.min(1, provider.rating.totalVotes / 20);
    score += reviewCountScore * 0.3;
    
    // Vérification WhatsApp (20%)
    if (provider.whatsappVerified) score += 0.2;
    
    // Badges (10%)
    const badgeScore = Math.min(0.1, provider.gamification.badges.length * 0.02);
    score += badgeScore;
    
    return score;
  }

  /**
   * Calcule le score de disponibilité
   */
  calculateAvailabilityScore(provider, timePreferences) {
    if (!provider.availability || provider.availability.length === 0) return 0;
    
    let score = 0;
    
    // Score basé sur le nombre de jours de disponibilité
    const dayScore = provider.availability.length / 7;
    score += dayScore * 0.6;
    
    // Correspondance avec les créneaux préférés du client
    if (timePreferences.preferredSlots.length > 0) {
      const slotMatch = this.calculateTimeSlotMatch(provider, timePreferences.preferredSlots);
      score += slotMatch * 0.4;
    }
    
    return score;
  }

  /**
   * Calcule le score d'engagement
   */
  calculateEngagementScore(provider, engagementPatterns) {
    let score = 0;
    
    // Réactivité (basé sur le classement)
    if (provider.gamification.ranking?.weekly) {
      const rankingScore = Math.max(0, 1 - (provider.gamification.ranking.weekly / 100));
      score += rankingScore * engagementPatterns.responsivenessImportance;
    }
    
    // Complétion du profil
    const profileCompleteness = this.calculateProfileCompleteness(provider);
    score += profileCompleteness * engagementPatterns.profileCompletenessImportance;
    
    // Popularité
    const popularityScore = Math.min(1, (provider.profileStats.totalViews || 0) / 100);
    score += popularityScore * engagementPatterns.popularityImportance;
    
    return score;
  }

  /**
   * Vérifie si le client a déjà interagi avec ce prestataire
   */
  hasInteractedWithProvider(client, providerId) {
    const viewed = client.activity.profilesViewed?.some(
      view => view.providerId?.toString() === providerId.toString()
    );
    
    const contacted = client.activity.contactsMade?.some(
      contact => contact.providerId?.toString() === providerId.toString()
    );
    
    const favorited = client.favorites?.some(
      favorite => favorite.providerId?.toString() === providerId.toString()
    );
    
    return viewed || contacted || favorited;
  }

  /**
   * Génère une explication pour la recommandation
   */
  generateExplanation(scoredProvider, preferences) {
    const reasons = [];
    const breakdown = scoredProvider.breakdown;
    
    if (breakdown.serviceMatch > 15) {
      reasons.push('Correspond parfaitement à vos services recherchés');
    }
    
    if (breakdown.zoneMatch > 10) {
      reasons.push('Disponible dans vos zones préférées');
    }
    
    if (breakdown.quality > 15) {
      reasons.push('Haute qualité de service et bonnes évaluations');
    }
    
    if (breakdown.availability > 10) {
      reasons.push('Disponible aux horaires qui vous conviennent');
    }
    
    if (scoredProvider.provider.gamification.badges.length > 0) {
      reasons.push('Prestataire certifié et reconnu');
    }
    
    return reasons.length > 0 ? reasons : ['Prestataire correspondant à votre profil'];
  }

  // 🛠️ Méthodes utilitaires

  extractServicesFromQuery(query) {
    const serviceKeywords = {
      'ménage': ['ménage', 'nettoyage', 'clean', 'housekeeping'],
      'jardinage': ['jardin', 'jardinage', 'garden', 'entretien'],
      'babysitting': ['baby', 'enfant', 'garde', 'babysitting'],
      'cuisine': ['cuisine', 'repas', 'cook', 'culinaire'],
      'réparation': ['réparation', 'réparer', 'fix', 'reparation']
    };
    
    const foundServices = [];
    const lowerQuery = query.toLowerCase();
    
    Object.entries(serviceKeywords).forEach(([service, keywords]) => {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        foundServices.push(service);
      }
    });
    
    return foundServices;
  }

  getTimeSlot(hour) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  extractPreferredDays(client) {
    const dayCount = {};
    
    client.activity.contactsMade?.forEach(contact => {
      const day = new Date(contact.contactDate).toLocaleDateString('fr-FR', { weekday: 'long' });
      dayCount[day] = (dayCount[day] || 0) + 1;
    });
    
    return Object.entries(dayCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([day]) => day);
  }

  calculateTimeSlotMatch(provider, preferredSlots) {
    // 🕒 Implémentation simplifiée - en production, analyser les créneaux
    return provider.availability && provider.availability.length > 2 ? 0.8 : 0.5;
  }

  calculateProfileCompleteness(provider) {
    const requiredFields = [
      provider.fullName,
      provider.description,
      provider.services?.length > 0,
      provider.availability?.length > 0,
      provider.zones?.length > 0,
      provider.profilePhoto
    ];
    
    const completed = requiredFields.filter(Boolean).length;
    return completed / requiredFields.length;
  }

  /**
   * Recommandations basées sur la similarité avec d'autres clients
   */
  async getCollaborativeRecommendations(clientId, limit = 10) {
    // 🎯 Implémentation future : filtrage collaboratif
    // Pour l'instant, on utilise les recommandations personnalisées
    return this.getPersonalizedRecommendations(clientId, { limit });
  }

  /**
   * Recommandations trending (populaires en ce moment)
   */
  async getTrendingRecommendations(limit = 10) {
    try {
      const trendingProviders = await ServiceProvider.find({ isActive: true })
        .sort({ 
          'profileStats.totalViews': -1,
          'contactCount': -1,
          'rating.average': -1 
        })
        .limit(limit)
        .select('fullName profilePhoto rating services zones profileStats gamification');
      
      return {
        success: true,
        data: trendingProviders,
        type: 'trending',
        generatedAt: new Date()
      };
      
    } catch (error) {
      console.error('❌ Erreur recommandations trending:', error);
      throw error;
    }
  }
}

module.exports = new RecommendationService();