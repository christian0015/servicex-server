// models/message.model.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Référence à la conversation
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  
  // Expéditeur
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  senderType: {
    type: String,
    enum: ['client', 'provider'],
    required: true
  },
  
  // Contenu du message
  content: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  
  // Fichiers joints (optionnel)
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number
  }],
  
  // Statut de lecture
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  
  // Métadonnées
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  collection: 'serviceXMessages'
});

// Index pour performances
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

// Méthode pour marquer comme lu
messageSchema.methods.markAsRead = function() {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Middleware pour mettre à jour la conversation avant sauvegarde
messageSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const Conversation = mongoose.model('Conversation');
      await Conversation.findByIdAndUpdate(
        this.conversationId,
        { $inc: { messageCount: 1 } }
      );
    } catch (error) {
      console.error('Error updating conversation message count:', error);
    }
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);