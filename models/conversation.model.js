// models/conversation.model.js
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Participants
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceProvider',
    required: true
  },
  
  // Métadonnées de la conversation
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked', 'completed'],
    default: 'active'
  },
  
  // Dernier message pour affichage rapide
  lastMessage: {
    text: String,
    senderType: {
      type: String,
      enum: ['client', 'provider']
    },
    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Compteurs pour optimisation
  messageCount: {
    type: Number,
    default: 0
  },
  unreadCountClient: {
    type: Number,
    default: 0
  },
  unreadCountProvider: {
    type: Number,
    default: 0
  },
  
  // Service concerné
  serviceType: {
    type: String,
    required: true
  },
  
  // Métadonnées
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'serviceXConversations'
});

// Index pour performances
conversationSchema.index({ clientId: 1, providerId: 1 }, { unique: true });
conversationSchema.index({ clientId: 1, updatedAt: -1 });
conversationSchema.index({ providerId: 1, updatedAt: -1 });
conversationSchema.index({ 'lastMessage.sentAt': -1 });

// Méthode pour mettre à jour le dernier message
conversationSchema.methods.updateLastMessage = function(messageText, senderType) {
  this.lastMessage = {
    text: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
    senderType: senderType,
    sentAt: new Date()
  };
  this.messageCount += 1;
  this.updatedAt = new Date();
  return this.save();
};

// Méthode pour incrémenter les compteurs de messages non lus
conversationSchema.methods.incrementUnreadCount = function(recipientType) {
  if (recipientType === 'client') {
    this.unreadCountClient += 1;
  } else {
    this.unreadCountProvider += 1;
  }
  return this.save();
};

// Méthode pour réinitialiser les compteurs de messages non lus
conversationSchema.methods.resetUnreadCount = function(userType) {
  if (userType === 'client') {
    this.unreadCountClient = 0;
  } else {
    this.unreadCountProvider = 0;
  }
  return this.save();
};

module.exports = mongoose.model('Conversation', conversationSchema);