const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
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
  
  // Description et services
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  services: [{
    label: { 
      type: String, 
      required: true 
    },
    isCustom: { 
      type: Boolean, 
      default: false 
    },
    price: {
      type: Number,
      default: 0
    }
  }],
  
  // Disponibilité
  availability: [{
    day: {
      type: String,
      enum: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
    },
    timeSlots: [{
      from: String,
      to: String
    }]
  }],
  
  // Zone d'activité
  zones: [{
    type: String
  }],
  
  // NOUVEAU : Statut temps réel
    currentStatus: {
    status: {
        type: String,
        enum: ['available', 'busy', 'offline', 'on_break'],
        default: 'offline'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    nextAvailable: Date, // Prochaine disponibilité si busy
    autoUpdate: { // Mise à jour automatique par géolocalisation
        type: Boolean,
        default: false
    }
    },

     // AJOUT : Historique des statuts manquant
  statusHistory: [{
    status: {
      type: String,
      enum: ['available', 'busy', 'offline', 'on_break']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    nextAvailable: Date
  }],
  
  // Système d'abonnement pour la promotion
  subscription: {
    planType: {
      type: String,
      enum: ['free', 'daily', 'monthly', 'yearly'],
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
    }
  },
  
  // NOUVEAU : Statistiques de visibilité DÉTAILLÉES par semaine
  profileStats: {
    // Vue d'ensemble
    totalViews: {
      type: Number,
      default: 0
    },
    // Détails par semaine (52 dernières semaines)
    weeklyViews: [{
      weekStart: { // Date du lundi de la semaine
        type: Date,
        required: true
      },
      weekNumber: { // Numéro de la semaine dans l'année
        type: Number,
        required: true
      },
      viewCount: {
        type: Number,
        default: 0
      },
      uniqueViewers: { // Clients uniques ayant vu le profil
        type: Number,
        default: 0
      }
    }],
    // Dernières vues détaillées (pour voir QUI a regardé)
    recentViews: [{
      clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
      },
      viewedAt: {
        type: Date,
        default: Date.now
      },
      // Pour savoir si la vue a mené à un contact
      ledToContact: {
        type: Boolean,
        default: false
      }
    }],
    // Meilleures semaines pour analyse
    bestWeek: {
      weekStart: Date,
      viewCount: Number
    }
  },
  
  // Contact et engagement
  contactCount: {
    type: Number,
    default: 0
  },
  lastViewed: {
    type: Date
  },
  
  // Validation et statut
  whatsappVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Évaluations
  rating: {
    average: {
      type: Number,
      default: 0
    },
    totalVotes: {
      type: Number,
      default: 0
    },
    reviews: [{
      clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
      },
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String,
      createdAt: {
        type: Date,
        default: Date.now
      }
    }]
  },

  // Extension du modèle avec gamification
    gamification: {
    badges: [{
        name: {
        type: String,
        required: true
        },
        type: {
        type: String,
        enum: ['performance', 'reliability', 'speed', 'quality', 'popularity'],
        required: true
        },
        earnedAt: {
        type: Date,
        default: Date.now
        },
        level: { // Niveau du badge (bronze, argent, or)
        type: String,
        enum: ['bronze', 'silver', 'gold'],
        default: 'bronze'
        }
    }],
    points: {
        total: { type: Number, default: 0 },
        weekly: { type: Number, default: 0 },
        monthly: { type: Number, default: 0 }
    },
    ranking: {
        weekly: { type: Number }, // Classement hebdo
        monthly: { type: Number }, // Classement mensuel
        category: { type: Number } // Classement par catégorie
    },
    streaks: {
        response: { type: Number, default: 0 }, // Jours consécutifs de réponse rapide
        completion: { type: Number, default: 0 } // Missions complétées sans annulation
    }
    },
  
  // Métriques d'activité
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
}, { collection: 'serviceXProviders' });

// Méthode pour ajouter une vue au profil
serviceProviderSchema.methods.addProfileView = function(clientId) {
  const now = new Date();
  const weekStart = this.getWeekStart(now);
  const weekNumber = this.getWeekNumber(now);
  
  // Mettre à jour le total
  this.profileStats.totalViews += 1;
  
  // Ajouter aux vues récentes (limité à 50)
  this.profileStats.recentViews.unshift({
    clientId: clientId,
    viewedAt: now
  });
  
  if (this.profileStats.recentViews.length > 50) {
    this.profileStats.recentViews = this.profileStats.recentViews.slice(0, 50);
  }
  
  // Mettre à jour les stats hebdomadaires
  let weekStat = this.profileStats.weeklyViews.find(w => 
    w.weekStart.getTime() === weekStart.getTime()
  );
  
  if (!weekStat) {
    weekStat = {
      weekStart: weekStart,
      weekNumber: weekNumber,
      viewCount: 0,
      uniqueViewers: 0
    };
    this.profileStats.weeklyViews.unshift(weekStat);
    
    // Garder seulement les 52 dernières semaines
    if (this.profileStats.weeklyViews.length > 52) {
      this.profileStats.weeklyViews = this.profileStats.weeklyViews.slice(0, 52);
    }
  }
  
  weekStat.viewCount += 1;
  
  // Compter les viewers uniques pour la semaine
  const uniqueViewersThisWeek = new Set(
    this.profileStats.recentViews
      .filter(view => this.getWeekStart(view.viewedAt).getTime() === weekStart.getTime())
      .map(view => view.clientId.toString())
  );
  weekStat.uniqueViewers = uniqueViewersThisWeek.size;
  
  // Mettre à jour la meilleure semaine
  this.updateBestWeek();
  
  return this.save();
};

// Méthode utilitaire pour obtenir le début de la semaine (lundi)
serviceProviderSchema.methods.getWeekStart = function(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour commencer le lundi
  return new Date(d.setDate(diff));
};

// Méthode utilitaire pour obtenir le numéro de semaine
serviceProviderSchema.methods.getWeekNumber = function(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

// Méthode pour mettre à jour la meilleure semaine
serviceProviderSchema.methods.updateBestWeek = function() {
  if (this.profileStats.weeklyViews.length === 0) return;
  
  const bestWeek = this.profileStats.weeklyViews.reduce((best, current) => {
    return current.viewCount > best.viewCount ? current : best;
  });
  
  this.profileStats.bestWeek = {
    weekStart: bestWeek.weekStart,
    viewCount: bestWeek.viewCount
  };
};



// Méthode pour mise à jour intelligente
serviceProviderSchema.methods.updateStatus = function(newStatus, nextAvailable = null) {
  this.currentStatus.status = newStatus;
  this.currentStatus.lastUpdated = new Date();
  
  if (nextAvailable) {
    this.currentStatus.nextAvailable = nextAvailable;
  }
  
  // Log historique des statuts pour analytics
  this.statusHistory = this.statusHistory || [];
  this.statusHistory.unshift({
    status: newStatus,
    timestamp: new Date(),
    nextAvailable: nextAvailable
  });
  
  // Garder seulement les 100 derniers statuts
  if (this.statusHistory.length > 100) {
    this.statusHistory = this.statusHistory.slice(0, 100);
  }
  
  return this.save();
};

// Vérifier disponibilité immédiate
serviceProviderSchema.methods.isAvailableNow = function() {
  if (this.currentStatus.status !== 'available') return false;
  
  const now = new Date();
  const currentDay = now.toLocaleDateString('fr-FR', { weekday: 'long' });
  const currentTime = now.toTimeString().slice(0, 5); // "14:30"
  
  const todayAvailability = this.availability.find(a => a.day === currentDay);
  if (!todayAvailability) return false;
  
  return todayAvailability.timeSlots.some(slot => 
    slot.from <= currentTime && slot.to >= currentTime
  );
};

// ⚠️ AJOUTEZ CETTE MÉTHODE MANQUANTE (utilisée dans getAvailabilityScore)
serviceProviderSchema.methods.timeToMinutes = function(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};


// // Badges prédéfinis
// const BADGES_CONFIG = {
//   'response_rapide': { 
//     condition: (provider) => provider.getAverageResponseTime() < 30, // minutes
//     levels: { bronze: 10, silver: 50, gold: 100 } // Nombre de fois
//   },
//   'fiable': {
//     condition: (provider) => provider.rating.average >= 4.5,
//     levels: { bronze: 5, silver: 25, gold: 100 } // Nombre d'avis
//   },
//   'top_note': {
//     condition: (provider) => provider.rating.average >= 4.8,
//     levels: { bronze: 10, silver: 30, gold: 50 } // Nombre d'avis
//   },
//   'super_dispo': {
//     condition: (provider) => provider.getAvailabilityScore() > 0.8,
//     levels: { bronze: 1, silver: 2, gold: 4 } // Semaines consécutives
//   }
// };

// // Méthode de calcul des badges
// serviceProviderSchema.methods.updateBadges = function() {
//   const newBadges = [];
  
//   Object.entries(BADGES_CONFIG).forEach(([badgeName, config]) => {
//     if (config.condition(this)) {
//       const currentCount = this.getBadgeCount(badgeName);
//       let level = 'bronze';
      
//       if (currentCount >= config.levels.gold) level = 'gold';
//       else if (currentCount >= config.levels.silver) level = 'silver';
      
//       newBadges.push({
//         name: badgeName,
//         type: this.getBadgeType(badgeName),
//         level: level
//       });
//     }
//   });
  
//   this.gamification.badges = newBadges;
//   return this.save();
// };
// ... (le reste du modèle reste identique)


// === CORRECTION : Méthodes manquantes pour les badges ===

// Méthode pour calculer le temps de réponse moyen
serviceProviderSchema.methods.getAverageResponseTime = function() {
  // Implémentation simplifiée - à adapter avec vos données réelles
  if (!this.rating.reviews || this.rating.reviews.length === 0) return 60; // 60 minutes par défaut
  
  // Calcul basé sur les horaires de création des reviews vs contacts
  const totalResponseTime = this.rating.reviews.reduce((sum, review) => {
    // // Simuler un temps de réponse basé sur la note
    // return sum + (30 - (review.rating * 5)); // Meilleure note = réponse plus rapide
    // Meilleure note = temps de réponse plus rapide
    // 5 étoiles = 15min, 1 étoile = 120min
    const responseTime = 120 - (review.rating * 21); // 120 - (5*21) = 15, 120 - (1*21) = 99
    return sum + Math.max(5, responseTime);
  }, 0);
  
  // return Math.max(5, totalResponseTime / this.rating.reviews.length);
  return totalResponseTime / this.rating.reviews.length;
};

// Méthode pour calculer le score de disponibilité
serviceProviderSchema.methods.getAvailabilityScore = function() {
  if (!this.availability || this.availability.length === 0) return 0;
  
  const totalDays = 7;
  const availableDays = this.availability.length;
  const baseScore = availableDays / totalDays;
  
  // Bonus pour les créneaux étendus
  let timeBonus = 0;
  this.availability.forEach(day => {
    day.timeSlots.forEach(slot => {
      // const from = parseInt(slot.from.replace(':', ''));
      // const to = parseInt(slot.to.replace(':', ''));
      // const duration = to - from;
      // if (duration > 400) timeBonus += 0.1; // +0.1 pour créneaux > 4h
      // ⚠️ CORRECTION : Meilleure conversion heure→minutes
      const fromMinutes = this.timeToMinutes(slot.from);
      const toMinutes = this.timeToMinutes(slot.to);
      const duration = toMinutes - fromMinutes;
      
      if (duration > 240) timeBonus += 0.1; // +0.1 pour créneaux > 4h
    });
  });
  
  return Math.min(1, baseScore + timeBonus);
};

// Méthode pour compter les badges d'un type spécifique
serviceProviderSchema.methods.getBadgeCount = function(badgeName) {
  if (!this.gamification.badges) return 0;
  return this.gamification.badges.filter(badge => badge.name === badgeName).length;
};

// Méthode pour déterminer le type de badge
serviceProviderSchema.methods.getBadgeType = function(badgeName) {
  const typeMap = {
    'response_rapide': 'speed',
    'fiable': 'reliability',
    'top_note': 'quality', 
    'super_dispo': 'availability',
    'populaire': 'popularity'
  };
  return typeMap[badgeName] || 'performance';
};

// === NOUVELLE : Configuration des badges ===
serviceProviderSchema.statics.BADGES_CONFIG = {
  'response_rapide': { 
    condition: (provider) => provider.getAverageResponseTime() < 30,
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
    condition: (provider) => provider.getAvailabilityScore() > 0.8,
    levels: { bronze: 1, silver: 2, gold: 4 }
  },
  'populaire': {
    condition: (provider) => (provider.profileStats?.totalViews || 0) > 100,
    levels: { bronze: 100, silver: 500, gold: 1000 }
  }
};

// === CORRECTION : Méthode updateBadges améliorée ===
serviceProviderSchema.methods.updateBadges = async function() {
  const newBadges = [];
  
  for (const [badgeName, config] of Object.entries(this.constructor.BADGES_CONFIG)) {
    if (config.condition(this)) {
      const currentCount = this.getBadgeProgress(badgeName);
      const level = this.determineBadgeLevel(currentCount, config.levels);
      
      // Vérifier si le badge existe déjà au même niveau
      const existingBadge = this.gamification.badges?.find(b => 
        b.name === badgeName && b.level === level
      );
      
      if (!existingBadge) {
        newBadges.push({
          name: badgeName,
          type: this.getBadgeType(badgeName),
          level: level,
          earnedAt: new Date(),
          progress: currentCount
        });
      }
    }
  }
  
  // Fusionner avec les badges existants (conserver les anciens niveaux)
  const existingBadges = this.gamification.badges || [];
  const mergedBadges = [...existingBadges];
  
  newBadges.forEach(newBadge => {
    const existingIndex = mergedBadges.findIndex(b => b.name === newBadge.name);
    if (existingIndex >= 0) {
      mergedBadges[existingIndex] = newBadge; // Remplacer par le nouveau niveau
    } else {
      mergedBadges.push(newBadge);
    }
  });
  
  this.gamification.badges = mergedBadges;
  return this.save();
};

// Méthode utilitaire pour la progression des badges
serviceProviderSchema.methods.getBadgeProgress = function(badgeName) {
  switch (badgeName) {
    case 'response_rapide':
      return this.rating?.totalVotes || 0;
    case 'fiable':
      return this.rating?.totalVotes || 0;
    case 'top_note':
      return this.rating?.totalVotes || 0;
    case 'super_dispo':
      return this.getConsecutiveWeeks();
    case 'populaire':
      return this.profileStats?.totalViews || 0;
    default:
      return 0;
  }
};

// Méthode utilitaire pour déterminer le niveau du badge
serviceProviderSchema.methods.determineBadgeLevel = function(currentCount, levels) {
  if (currentCount >= levels.gold) return 'gold';
  if (currentCount >= levels.silver) return 'silver';
  return 'bronze';
};

// Méthode utilitaire pour les semaines consécutives
serviceProviderSchema.methods.getConsecutiveWeeks = function() {
  if (!this.profileStats?.weeklyViews) return 0;
  
  let consecutive = 0;
  const sortedWeeks = [...this.profileStats.weeklyViews]
    .sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
  
  for (const week of sortedWeeks) {
    if (week.viewCount > 0) consecutive++;
    else break;
  }
  
  return consecutive;
};
// ... (le reste du modèle reste identique)
// Middleware pour updatedAt
serviceProviderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);
