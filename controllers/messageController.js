// controllers/messageController.js
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const Client = require('../models/client.model');
const ServiceProvider = require('../models/serviceProvider.model');
const notificationService = require('../services/notifications/notificationService');

class MessageController {
  
  /**
   * 🗨️ Démarrer ou récupérer une conversation
   */
  async getOrCreateConversation(req, res) {
    try {
      const { providerId, serviceType } = req.body;
      const clientId = req.user.id;
      const userType = req.user.model.toLowerCase(); // 'client' ou 'serviceprovider'

      // Vérification des permissions
      if (userType !== 'client') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les clients peuvent initier des conversations'
        });
      }

      // Vérifier que le prestataire existe
      const provider = await ServiceProvider.findById(providerId);
      if (!provider || !provider.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire non trouvé ou inactif'
        });
      }

      // Chercher une conversation existante
      let conversation = await Conversation.findOne({
        clientId,
        providerId,
        status: 'active'
      })
      .populate('clientId', 'fullName profilePhoto')
      .populate('providerId', 'fullName profilePhoto services');

      // Créer une nouvelle conversation si elle n'existe pas
      if (!conversation) {
        conversation = new Conversation({
          clientId,
          providerId,
          serviceType: serviceType || provider.services[0]?.label || 'Service général',
          status: 'active'
        });

        await conversation.save();
        
        // Populer les données après sauvegarde
        conversation = await Conversation.findById(conversation._id)
          .populate('clientId', 'fullName profilePhoto')
          .populate('providerId', 'fullName profilePhoto services');
      }

      res.json({
        success: true,
        data: conversation
      });

    } catch (error) {
      console.error('❌ Erreur création conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création de la conversation'
      });
    }
  }

  /**
   * 📨 Envoyer un message
   */
  async sendMessage(req, res) {
    try {
      const { conversationId, content, messageType = 'text', attachments = [] } = req.body;
      const senderId = req.user.id;
      const senderType = req.user.model.toLowerCase(); // 'client' ou 'serviceprovider'

      // Validation
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Le contenu du message ne peut pas être vide'
        });
      }

      if (content.length > 2000) {
        return res.status(400).json({
          success: false,
          message: 'Le message ne peut pas dépasser 2000 caractères'
        });
      }

      // Vérifier que la conversation existe et que l'utilisateur y a accès
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation non trouvée'
        });
      }

      // Vérifier les permissions
      const isParticipant = 
        (senderType === 'client' && conversation.clientId.toString() === senderId) ||
        (senderType === 'provider' && conversation.providerId.toString() === senderId);

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à cette conversation'
        });
      }

      // Créer le message
      const message = new Message({
        conversationId,
        senderId,
        senderType,
        content: content.trim(),
        messageType,
        attachments
      });

      await message.save();

      // Mettre à jour la conversation
      await conversation.updateLastMessage(content, senderType);

      // Déterminer le destinataire et incrémenter son compteur de messages non lus
      const recipientType = senderType === 'client' ? 'provider' : 'client';
      await conversation.incrementUnreadCount(recipientType);

      // Préparer les données pour la notification
      let recipientId, recipientName, senderName;

      if (senderType === 'client') {
        const client = await Client.findById(senderId, 'fullName');
        senderName = client.fullName;
        recipientId = conversation.providerId;
        const provider = await ServiceProvider.findById(conversation.providerId, 'fullName');
        recipientName = provider.fullName;
      } else {
        const provider = await ServiceProvider.findById(senderId, 'fullName');
        senderName = provider.fullName;
        recipientId = conversation.clientId;
        const client = await Client.findById(conversation.clientId, 'fullName');
        recipientName = client.fullName;
      }

      try{
        // Envoyer une notification
        await notificationService.notifyNewMessage(
            recipientId,
            senderType === 'client' ? 'ServiceProvider' : 'Client',
            {
            conversationId: conversation._id,
            senderName,
            messagePreview: content.length > 50 ? content.substring(0, 50) + '...' : content,
            unreadCount: senderType === 'client' ? conversation.unreadCountProvider : conversation.unreadCountClient
            }
        );
      }catch(e){
        console.log("Zut erreur de Notif, c pas grave Inshallah ");
        
      }
      

      // Populer le message pour la réponse
      const populatedMessage = await Message.findById(message._id)
        .populate('conversationId', 'clientId providerId serviceType');

      res.json({
        success: true,
        message: 'Message envoyé avec succès',
        data: populatedMessage
      });

    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'envoi du message'
      });
    }
  }

  /**
   * 📋 Récupérer les conversations d'un utilisateur
   */
  async getUserConversations(req, res) {
    try {
      const userId = req.user.id;
      const userType = req.user.model; // 'Client' ou 'ServiceProvider'
      const { page = 1, limit = 20, status = 'active' } = req.query;

      // Construire la query selon le type d'utilisateur
      const query = { status };
      if (userType === 'Client') {
        query.clientId = userId;
      } else {
        query.providerId = userId;
      }

      const conversations = await Conversation.find(query)
        .populate('clientId', 'fullName profilePhoto')
        .populate('providerId', 'fullName profilePhoto services rating')
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean();

      // Compter le total pour la pagination
      const total = await Conversation.countDocuments(query);

      res.json({
        success: true,
        data: {
          conversations,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération conversations:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des conversations'
      });
    }
  }

  /**
   * 📜 Récupérer les messages d'une conversation
   */
  async getConversationMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;
      const userType = req.user.model.toLowerCase();
      const { page = 1, limit = 50 } = req.query;

      // Vérifier que l'utilisateur a accès à cette conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation non trouvée'
        });
      }

      const isParticipant = 
        (userType === 'client' && conversation.clientId.toString() === userId) ||
        (userType === 'provider' && conversation.providerId.toString() === userId);

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à cette conversation'
        });
      }

      // Récupérer les messages avec pagination
      const messages = await Message.find({ conversationId })
        .sort({ createdAt: -1 }) // Plus récents en premier
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .lean();

      // Inverser l'ordre pour avoir les plus anciens en premier
      messages.reverse();

      // Marquer les messages comme lus si c'est le destinataire
      if (messages.length > 0) {
        const unreadMessages = messages.filter(msg => 
          !msg.read && 
          ((userType === 'client' && msg.senderType === 'provider') ||
           (userType === 'provider' && msg.senderType === 'client'))
        );

        if (unreadMessages.length > 0) {
          await Message.updateMany(
            { 
              _id: { $in: unreadMessages.map(msg => msg._id) },
              read: false
            },
            { 
              $set: { 
                read: true, 
                readAt: new Date() 
              } 
            }
          );

          // Réinitialiser le compteur de messages non lus
          await conversation.resetUnreadCount(userType);
        }
      }

      // Compter le total de messages
      const totalMessages = await Message.countDocuments({ conversationId });

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalMessages,
            totalPages: Math.ceil(totalMessages / parseInt(limit))
          },
          conversation: {
            id: conversation._id,
            serviceType: conversation.serviceType,
            unreadCount: userType === 'client' ? 
              conversation.unreadCountClient : conversation.unreadCountProvider
          }
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération messages:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des messages'
      });
    }
  }

  /**
   * 🔢 Récupérer le nombre de messages non lus
   */
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const userType = req.user.model; // 'Client' ou 'ServiceProvider'

      const query = { status: 'active' };
      const unreadField = userType === 'Client' ? 'unreadCountClient' : 'unreadCountProvider';

      if (userType === 'Client') {
        query.clientId = userId;
      } else {
        query.providerId = userId;
      }

      const totalUnread = await Conversation.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: `$${unreadField}` } } }
      ]);

      const totalConversations = await Conversation.countDocuments(query);

      res.json({
        success: true,
        data: {
          totalUnread: totalUnread[0]?.total || 0,
          totalConversations
        }
      });

    } catch (error) {
      console.error('❌ Erreur comptage messages non lus:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors du comptage des messages non lus'
      });
    }
  }

  /**
   * 🗑️ Supprimer une conversation (archivage)
   */
  async archiveConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const userId = req.user.id;
      const userType = req.user.model.toLowerCase();

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation non trouvée'
        });
      }

      // Vérifier les permissions
      const isParticipant = 
        (userType === 'client' && conversation.clientId.toString() === userId) ||
        (userType === 'provider' && conversation.providerId.toString() === userId);

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à cette conversation'
        });
      }

      conversation.status = 'archived';
      await conversation.save();

      res.json({
        success: true,
        message: 'Conversation archivée avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur archivage conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de l\'archivage de la conversation'
      });
    }
  }

  /**
   * 🔍 Rechercher dans les messages
   */
  async searchMessages(req, res) {
    try {
      const { conversationId, query } = req.query;
      const userId = req.user.id;
      const userType = req.user.model.toLowerCase();

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'La requête de recherche doit contenir au moins 2 caractères'
        });
      }

      let searchQuery = {
        content: { $regex: query.trim(), $options: 'i' }
      };

      // Si une conversation spécifique est fournie, vérifier les permissions
      if (conversationId) {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          return res.status(404).json({
            success: false,
            message: 'Conversation non trouvée'
          });
        }

        const isParticipant = 
          (userType === 'client' && conversation.clientId.toString() === userId) ||
          (userType === 'provider' && conversation.providerId.toString() === userId);

        if (!isParticipant) {
          return res.status(403).json({
            success: false,
            message: 'Accès non autorisé à cette conversation'
          });
        }

        searchQuery.conversationId = conversationId;
      } else {
        // Rechercher dans toutes les conversations de l'utilisateur
        const userConversations = await Conversation.find({
          status: 'active',
          $or: [
            { clientId: userId },
            { providerId: userId }
          ]
        }).select('_id');

        searchQuery.conversationId = { 
          $in: userConversations.map(conv => conv._id) 
        };
      }

      const messages = await Message.find(searchQuery)
        .populate('conversationId', 'clientId providerId serviceType')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      res.json({
        success: true,
        data: {
          messages,
          total: messages.length
        }
      });

    } catch (error) {
      console.error('❌ Erreur recherche messages:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche dans les messages'
      });
    }
  }
}

module.exports = new MessageController();