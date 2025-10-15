const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // 👥 Utilisateur destinataire
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Client', 'ServiceProvider']
  },
  
  // 📋 Contenu de la notification
  type: {
    type: String,
    required: true,
    enum: [
      'new_contact',           // Nouvelle demande de service
      'contact_confirmation',  // Confirmation de contact
      'new_review',            // Nouvel avis
      'weekly_ranking',        // Classement hebdomadaire
      'badge_unlocked',        // Badge débloqué
      'subscription_activated', // Abonnement activé
      'subscription_expiring',  // Abonnement expirant
      'promotion',             // Promotion spéciale
      'system',                // Message système
      'security',              // Alerte sécurité
      'reminder'               // Rappel
    ]
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  
  // 🎯 Données supplémentaires
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // 📊 Métadonnées
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread'
  },
  
  // ⏰ Dates importantes
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },
  readAt: {
    type: Date
  },
  
  // 📍 Suivi de livraison
  delivered: {
    type: Boolean,
    default: false
  },
  deliveryMethod: {
    type: [String], // ['push', 'email', 'in_app']
    default: ['in_app']
  }
}, {
  timestamps: true,
  collection: 'serviceXNotifications'
});

// 🔍 Index pour les performances
notificationSchema.index({ userId: 1, userModel: 1, status: 1 });
notificationSchema.index({ userId: 1, userModel: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 🎯 Méthodes d'instance
notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.isExpired = function() {
  return this.expiresAt && this.expiresAt < new Date();
};

notificationSchema.methods.getPriorityInfo = function() {
  const priorities = {
    'low': { label: 'Basse', color: 'blue', icon: 'ℹ️' },
    'medium': { label: 'Moyenne', color: 'orange', icon: '⚠️' },
    'high': { label: 'Haute', color: 'red', icon: '🚨' }
  };
  return priorities[this.priority] || priorities.medium;
};

// 📊 Méthodes statiques
notificationSchema.statics.getUnreadCount = function(userId, userModel) {
  return this.countDocuments({ 
    userId, 
    userModel, 
    status: 'unread' 
  });
};

notificationSchema.statics.getRecentByType = function(userId, userModel, type, limit = 10) {
  return this.find({ userId, userModel, type })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model('Notification', notificationSchema);