const mongoose = require('mongoose');
const ServiceProvider = require('./serviceProvider.model'); // ⬅️ AJOUT IMPORT

const clientSchema = new mongoose.Schema({
  // Informations de base
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    lowercase: true,
    sparse: true
  },

  password: {
    type: String,
    required: true,
  },

  emailConfirmed: { type: Boolean, default: false },

  profilePhoto: {
    type: String,
    default: ''
  },
  
  // Localisation
  address: {
    street: String,
    city: String,
    zone: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Système d'abonnement premium
  subscription: {
    planType: {
      type: String,
      enum: ['free', 'premium_monthly', 'premium_yearly'],
      default: 'free'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active'
    },
    autoRenew: {
      type: Boolean,
      default: false
    },
    features: {
      unlimitedContacts: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      advancedSearch: { type: Boolean, default: false },
      noAds: { type: Boolean, default: false }
    }
  },
  
  // SUPPRIMÉ : Ancien système de quotas
  // usage: {
  //   dailyContacts: { type: Number, default: 0 },
  //   monthlyContacts: { type: Number, default: 0 },
  //   lastReset: { type: Date, default: Date.now }
  // },
  
  // NOUVEAU : Historique d'activité complet
  activity: {
    // Contacts établis (quand le client contacte un prestataire)
    contactsMade: [{
      providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider'
      },
      contactDate: {
        type: Date,
        default: Date.now
      },
      serviceType: String,
      status: { // Pour suivre l'état du contact
        type: String,
        enum: ['pending', 'accepted', 'completed', 'cancelled'],
        default: 'pending'
      }
    }],
    
    // Profils consultés (quand le client regarde un profil)
    profilesViewed: [{
      providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider'
      },
      viewedAt: {
        type: Date,
        default: Date.now
      },
      duration: { // Temps passé sur le profil en secondes
        type: Number,
        default: 0
      },
      saved: { // Si le client a sauvegardé ce profil
        type: Boolean,
        default: false
      }
    }],
    
    // Statistiques récapitulatives
    stats: {
      totalContacts: { type: Number, default: 0 },
      totalViews: { type: Number, default: 0 },
      favoriteCategories: [String], // Catégories les plus consultées
      lastActive: { type: Date, default: Date.now }
    }
  },

  // Nouvelle section pour les préférences comportementales
    behavioralPreferences: {
    frequentSearches: [{
        query: String,
        filters: Object,
        searchCount: { type: Number, default: 1 },
        lastSearched: { type: Date, default: Date.now },
        clickedResults: [{
        providerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ServiceProvider'
        },
        clickCount: Number
        }]
    }],
    preferredTimeSlots: [{
        day: String,
        timeRange: {
        from: String,
        to: String
        },
        preferenceScore: { type: Number, default: 1 } // 1-10
    }],
    budgetPatterns: {
        average: Number,
        min: Number,
        max: Number,
        preferredRanges: [{
        min: Number,
        max: Number,
        serviceType: String
        }]
    },
    reliabilityPreferences: {
        minRating: { type: Number, default: 4.0 },
        requireVerification: { type: Boolean, default: true },
        preferredResponseTime: Number // en minutes
    }
    },
  
  // Favoris (séparé de l'activité pour plus de clarté)
  favorites: [{
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceProvider'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    notes: String // Notes personnelles sur ce prestataire
  }],
  
  // Historique des recherches
  searchHistory: [{
    query: String,
    filters: Object,
    resultsCount: Number,
    searchedAt: {
      type: Date,
      default: Date.now
    },
    // Nouveau : sauvegarder les résultats importants
    savedResults: [{
      providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceProvider'
      },
      relevanceScore: Number // Score de pertinence (1-5)
    }]
  }],
  
  // Préférences
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    language: {
      type: String,
      default: 'fr'
    },
    preferredZones: [String],
    budgetRange: {
      min: Number,
      max: Number
    }
  },
  
  // Validation
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Métriques générales
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
}, { collection: 'serviceXClients' });

// Méthode pour ajouter une vue de profil
clientSchema.methods.addProfileView = function(providerId, duration = 0) {
  // Ajouter ou mettre à jour la vue
  const existingView = this.activity.profilesViewed.find(view => 
    view.providerId.toString() === providerId.toString()
  );
  
  if (existingView) {
    existingView.viewedAt = new Date();
    existingView.duration += duration;
  } else {
    this.activity.profilesViewed.unshift({
      providerId: providerId,
      viewedAt: new Date(),
      duration: duration
    });
  }
  
  // Limiter à 100 vues récentes
  if (this.activity.profilesViewed.length > 100) {
    this.activity.profilesViewed = this.activity.profilesViewed.slice(0, 100);
  }
  
  // Mettre à jour les stats
  this.activity.stats.totalViews += 1;
  this.activity.stats.lastActive = new Date();
  
  return this.save();
};


// ⭐ AJOUT : Méthode pour ajouter aux favoris
clientSchema.methods.addToFavorites = function(providerId, notes = '') {
  // Vérifier si déjà en favoris
  const existingFavorite = this.favorites.find(fav => 
    fav.providerId.toString() === providerId.toString()
  );
  
  if (existingFavorite) {
    throw new Error('Ce prestataire est déjà dans vos favoris');
  }
  
  // Ajouter aux favoris
  this.favorites.unshift({
    providerId: providerId,
    addedAt: new Date(),
    notes: notes
  });
  
  return this.save();
};


// Méthode pour établir un contact
clientSchema.methods.makeContact = function(providerId, serviceType) {
  this.activity.contactsMade.unshift({
    providerId: providerId,
    contactDate: new Date(),
    serviceType: serviceType,
    status: 'pending'
  });
  
  // Mettre à jour les stats
  this.activity.stats.totalContacts += 1;
  this.activity.stats.lastActive = new Date();
  
  return this.save();
};

// Méthode pour vérifier si le client peut contacter (pour les free users)
clientSchema.methods.canMakeContact = function() {
  if (this.subscription.planType !== 'free') {
    return true; // Premium = contacts illimités
  }
  
  // Pour free users : max 5 contacts par semaine
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const recentContacts = this.activity.contactsMade.filter(contact => 
    contact.contactDate >= oneWeekAgo
  );
  
  return recentContacts.length < 5;
};

// // Méthode pour générer des recommandations personnalisées
// clientSchema.methods.generateRecommendations = async function(limit = 10) {
//   const frequentServices = this.getMostFrequentServices();
//   const preferredZones = this.preferences.preferredZones;
//   const timePreferences = this.behavioralPreferences.preferredTimeSlots;
  
//   // Construction de la query intelligente
//   const query = {
//     'services.label': { $in: frequentServices },
//     'zones': { $in: preferredZones },
//     'rating.average': { $gte: this.behavioralPreferences.reliabilityPreferences.minRating },
//     'isActive': true
//   };
  
//   // Filtre par disponibilité selon les préférences horaires
//   const availabilityQuery = this.buildAvailabilityQuery(timePreferences);
  
//   const providers = await ServiceProvider.find({
//     ...query,
//     ...availabilityQuery
//   })
//   .limit(limit)
//   .sort({
//     'rating.average': -1,
//     'profileStats.totalViews': -1,
//     'gamification.points.total': -1
//   });
  
//   return this.scoreAndSortRecommendations(providers);
// };

// // Méthode pour scorer les recommandations
// clientSchema.methods.scoreAndSortRecommendations = function(providers) {
//   return providers.map(provider => {
//     let score = 0;
    
//     // Score basé sur la correspondance des services
//     const serviceMatch = this.calculateServiceMatch(provider);
//     score += serviceMatch * 0.4;
    
//     // Score basé sur la zone
//     const zoneMatch = this.calculateZoneMatch(provider);
//     score += zoneMatch * 0.2;
    
//     // Score basé sur la disponibilité
//     const availabilityMatch = this.calculateAvailabilityMatch(provider);
//     score += availabilityMatch * 0.2;
    
//     // Score basé sur la fiabilité (notes, badges)
//     const reliabilityScore = this.calculateReliabilityScore(provider);
//     score += reliabilityScore * 0.2;
    
//     return {
//       provider,
//       matchScore: Math.round(score * 100),
//       reasons: this.generateMatchReasons(provider, score)
//     };
//   }).sort((a, b) => b.matchScore - a.matchScore);
// };

// ... (le reste du modèle reste identique)





// === CORRECTION : Méthodes manquantes pour les recommandations ===


// ***************Proposition de la fonction getMostFrequentServices ********************
// **************************************************************************************
// // Méthode pour obtenir les services les plus fréquents - VERSION AMÉLIORÉE
// clientSchema.methods.getMostFrequentServices = function() {
//   const serviceCount = {};
  
//   // 1. Contacts établis - Poids fort (2 points)
//   this.activity.contactsMade?.forEach(contact => {
//     if (contact.serviceType) {
//       const normalizedService = this.normalizeServiceName(contact.serviceType);
//       serviceCount[normalizedService] = (serviceCount[normalizedService] || 0) + 2;
//     }
//   });
  
//   // 2. Historique de recherche - Poids moyen (1 point)
//   this.searchHistory?.forEach(search => {
//     if (search.query) {
//       const services = this.extractServicesFromQuery(search.query);
//       services.forEach(service => {
//         const normalizedService = this.normalizeServiceName(service);
//         serviceCount[normalizedService] = (serviceCount[normalizedService] || 0) + 1;
//       });
//     }
//   });
  
//   // 3. Favoris - Poids léger (0.5 point) si on veut inclure cette donnée
//   // (À implémenter si vous stockez les services des favoris)
  
//   // Trier et retourner les top 5
//   const topServices = Object.entries(serviceCount)
//     .sort(([,a], [,b]) => b - a)
//     .slice(0, 5)
//     .map(([service]) => service);
  
//   // Si pas assez de données, retourner des services par défaut
//   return topServices.length > 0 ? topServices : ['Ménage', 'Jardinage', 'Babysitting'];
// };

// // Méthode utilitaire pour normaliser les noms de services
// clientSchema.methods.normalizeServiceName = function(serviceName) {
//   const serviceMap = {
//     'menage': 'Ménage',
//     'nettoyage': 'Ménage',
//     'clean': 'Ménage',
//     'jardin': 'Jardinage',
//     'jardinage': 'Jardinage',
//     'garden': 'Jardinage',
//     'baby': 'Babysitting',
//     'enfant': 'Babysitting',
//     'garde': 'Babysitting',
//     'babysitting': 'Babysitting',
//     'cuisine': 'Cuisine',
//     'repas': 'Cuisine',
//     'cook': 'Cuisine',
//     'reparation': 'Réparation',
//     'reparer': 'Réparation',
//     'fix': 'Réparation'
//   };
  
//   const normalized = serviceMap[serviceName.toLowerCase()];
//   return normalized || serviceName;
// };
// **************************************************************
// **************************************************************

// Méthode pour obtenir les services les plus fréquents
clientSchema.methods.getMostFrequentServices = function() {
  const serviceCount = {};
  
  // Compter depuis les contacts établis
  this.activity.contactsMade?.forEach(contact => {
    if (contact.serviceType) {
      serviceCount[contact.serviceType] = (serviceCount[contact.serviceType] || 0) + 2;
    }
  });
  
  // Compter depuis les recherches
  this.searchHistory?.forEach(search => {
    if (search.query) {
      const services = this.extractServicesFromQuery(search.query);
      services.forEach(service => {
        serviceCount[service] = (serviceCount[service] || 0) + 1;
      });
    }
  });
  
  // ⚠️ SUPPRIMÉ : La partie avec profilesViewed car impossible sans populate
  // // Compter depuis les profils consultés
  // this.activity.profilesViewed?.forEach(view => {
  //   // Note: nécessite population du providerId
  //   if (view.providerId && view.providerId.services) {
  //     view.providerId.services.forEach(service => {
  //       serviceCount[service.label] = (serviceCount[service.label] || 0) + 0.5;
  //     });
  //   }
  // });
  
  return Object.entries(serviceCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([service]) => service);
};

// Méthode pour construire la query de disponibilité
clientSchema.methods.buildAvailabilityQuery = function(timePreferences) {
  if (!timePreferences || timePreferences.length === 0) return {};
  
  // Construction d'une query basique pour l'exemple
  // En production, vous voudrez une query plus sophistiquée
  const days = timePreferences.map(pref => pref.day);
  
  return {
    'availability.day': { $in: days }
  };
};

// Méthodes de scoring pour les recommandations
clientSchema.methods.calculateServiceMatch = function(provider) {
  const preferredServices = this.getMostFrequentServices();
  if (preferredServices.length === 0) return 0.5;
  
  const providerServices = provider.services.map(s => s.label);
  const matches = preferredServices.filter(service => 
    providerServices.includes(service)
  );
  
  return matches.length / preferredServices.length;
};

clientSchema.methods.calculateZoneMatch = function(provider) {
  const preferredZones = this.preferences?.preferredZones || [];
  if (preferredZones.length === 0) return 0.5;
  
  const matches = preferredZones.filter(zone => 
    provider.zones.includes(zone)
  );
  
  return matches.length / preferredZones.length;
};

clientSchema.methods.calculateAvailabilityMatch = function(provider) {
  if (!provider.availability || provider.availability.length === 0) return 0.2;
  
  const preferredTimeSlots = this.behavioralPreferences?.preferredTimeSlots || [];
  if (preferredTimeSlots.length === 0) return 0.5;
  
  let matchScore = 0;
  preferredTimeSlots.forEach(clientSlot => {
    const providerDay = provider.availability.find(a => a.day === clientSlot.day);
    if (providerDay) {
      matchScore += 0.3; // Correspondance du jour
      
      // Vérifier la correspondance des créneaux horaires
      providerDay.timeSlots.forEach(providerSlot => {
        if (this.timeSlotsOverlap(clientSlot.timeRange, providerSlot)) {
          matchScore += 0.2;
        }
      });
    }
  });
  
  return Math.min(1, matchScore);
};

clientSchema.methods.calculateReliabilityScore = function(provider) {
  let score = 0;
  
  // Note moyenne (40%)
  score += (provider.rating?.average || 0) / 5 * 0.4;
  
  // Nombre d'avis (20%)
  const reviewCount = provider.rating?.totalVotes || 0;
  score += Math.min(reviewCount / 50, 1) * 0.2;
  
  // Vérification WhatsApp (20%)
  if (provider.whatsappVerified) score += 0.2;
  
  // Badges (10%)
  const badgeCount = provider.gamification?.badges?.length || 0;
  score += Math.min(badgeCount / 10, 1) * 0.1;
  
  // Expérience (ancienneté) (10%)
  if (provider.createdAt) {
    const monthsActive = (new Date() - new Date(provider.createdAt)) / (1000 * 60 * 60 * 24 * 30);
    score += Math.min(monthsActive / 12, 1) * 0.1;
  }
  
  return score;
};

// Méthode pour générer les explications de matching
clientSchema.methods.generateMatchReasons = function(provider, score) {
  const reasons = [];
  
  if (score > 0.8) {
    reasons.push("Correspondance exceptionnelle avec votre profil");
  }
  
  // Vérifier la correspondance des services
  const serviceMatch = this.calculateServiceMatch(provider);
  if (serviceMatch > 0.7) {
    reasons.push("Propose vos services préférés");
  }
  
  // Vérifier la correspondance des zones
  const zoneMatch = this.calculateZoneMatch(provider);
  if (zoneMatch > 0.8) {
    reasons.push("Intervient dans vos zones préférées");
  }
  
  // Vérifier la fiabilité
  const reliability = this.calculateReliabilityScore(provider);
  if (reliability > 0.8) {
    reasons.push("Prestataire très fiable et bien noté");
  }
  
  if (reasons.length === 0) {
    reasons.push("Prestataire de qualité correspondant à vos critères");
  }
  
  return reasons.slice(0, 3); // Maximum 3 raisons
};

// === MÉTHODES UTILITAIRES ===

// Vérifier le chevauchement des créneaux horaires
clientSchema.methods.timeSlotsOverlap = function(clientSlot, providerSlot) {
  const clientFrom = this.timeToMinutes(clientSlot.from);
  const clientTo = this.timeToMinutes(clientSlot.to);
  const providerFrom = this.timeToMinutes(providerSlot.from);
  const providerTo = this.timeToMinutes(providerSlot.to);
  
  return clientFrom < providerTo && clientTo > providerFrom;
};

// Convertir le temps en minutes
clientSchema.methods.timeToMinutes = function(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Extraire les services depuis une requête de recherche
clientSchema.methods.extractServicesFromQuery = function(query) {
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
};

// === CORRECTION : Méthode generateRecommendations améliorée ===
clientSchema.methods.generateRecommendations = async function(limit = 10) {
  try {
    const frequentServices = this.getMostFrequentServices();
    const preferredZones = this.preferences?.preferredZones || [];
    const timePreferences = this.behavioralPreferences?.preferredTimeSlots || [];
    
    // Construction de la query de base
    const query = {
      isActive: true,
      'rating.average': { 
        $gte: this.behavioralPreferences?.reliabilityPreferences?.minRating || 3.0 
      }
    };
    
    // Ajouter les filtres de service si disponibles
    if (frequentServices.length > 0) {
      query['services.label'] = { $in: frequentServices };
    }
    
    // Ajouter les filtres de zone si disponibles
    if (preferredZones.length > 0) {
      query['zones'] = { $in: preferredZones };
    }
    
    // Construire la query de disponibilité
    const availabilityQuery = this.buildAvailabilityQuery(timePreferences);
    const finalQuery = { ...query, ...availabilityQuery };
    
    // Recherche des prestataires
    const providers = await ServiceProvider.find(finalQuery)
      .limit(limit * 2) // Prendre plus pour filtrer après
      .sort({
        'rating.average': -1,
        'profileStats.totalViews': -1,
        'gamification.points.total': -1
      });
    
    // Scoring et tri
    const scoredProviders = this.scoreAndSortRecommendations(providers);
    
    return scoredProviders.slice(0, limit);
    
  } catch (error) {
    console.error('Erreur génération recommandations:', error);
    return [];
  }
};

// === CORRECTION : Méthode scoreAndSortRecommendations améliorée ===
clientSchema.methods.scoreAndSortRecommendations = function(providers) {
  return providers.map(provider => {
    let score = 0;
    
    // Score basé sur la correspondance des services
    const serviceMatch = this.calculateServiceMatch(provider);
    score += serviceMatch * 0.4;
    
    // Score basé sur la zone
    const zoneMatch = this.calculateZoneMatch(provider);
    score += zoneMatch * 0.2;
    
    // Score basé sur la disponibilité
    const availabilityMatch = this.calculateAvailabilityMatch(provider);
    score += availabilityMatch * 0.2;
    
    // Score basé sur la fiabilité
    const reliabilityScore = this.calculateReliabilityScore(provider);
    score += reliabilityScore * 0.2;
    
    return {
      provider: {
        _id: provider._id,
        fullName: provider.fullName,
        profilePhoto: provider.profilePhoto,
        rating: provider.rating,
        services: provider.services,
        zones: provider.zones,
        description: provider.description
      },
      matchScore: Math.round(score * 100),
      breakdown: {
        serviceMatch: Math.round(serviceMatch * 40),
        zoneMatch: Math.round(zoneMatch * 20),
        availability: Math.round(availabilityMatch * 20),
        reliability: Math.round(reliabilityScore * 20)
      },
      reasons: this.generateMatchReasons(provider, score)
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
};
// ... (le reste du modèle reste identique)

module.exports = mongoose.model("Client", clientSchema);