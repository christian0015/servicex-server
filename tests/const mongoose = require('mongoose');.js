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
  
  // Statistiques de visibilité
  profileStats: {
    totalViews: {
      type: Number,
      default: 0
    },
    weeklyViews: [{
      weekStart: {
        type: Date,
        required: true
      },
      weekNumber: {
        type: Number,
        required: true
      },
      viewCount: {
        type: Number,
        default: 0
      },
      uniqueViewers: {
        type: Number,
        default: 0
      }
    }],
    recentViews: [{
      clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client'
      },
      viewedAt: {
        type: Date,
        default: Date.now
      },
      ledToContact: {
        type: Boolean,
        default: false
      }
    }],
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
  
  // Gamification
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
      level: {
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
      weekly: { type: Number },
      monthly: { type: Number },
      category: { type: Number }
    },
    streaks: {
      response: { type: Number, default: 0 },
      completion: { type: Number, default: 0 }
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

// 🔧 CORRECTION : Ajout des méthodes manquantes
serviceProviderSchema.methods.getAverageResponseTime = function() {
  // Implémentation simplifiée - à adapter selon vos besoins
  return 25; // minutes en moyenne
};

serviceProviderSchema.methods.getBadgeCount = function(badgeName) {
  return this.gamification.badges.filter(badge => badge.name === badgeName).length;
};

serviceProviderSchema.methods.updateBadges = async function() {
  // Implémentation simplifiée
  console.log(`Mise à jour des badges pour ${this.fullName}`);
  return this.save();
};

// Middleware pour mettre à jour la date de modification
serviceProviderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 🎯 CORRECTION : Export correct du modèle
const ServiceProvider = mongoose.model('ServiceProvider', serviceProviderSchema);
module.exports = ServiceProvider;