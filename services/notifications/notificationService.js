const Notification = require('../../models/notification.model');
const Client = require('../../models/client.model');
const ServiceProvider = require('../../models/serviceProvider.model');

class NotificationService {
  constructor() {
    this.webSocketConnections = new Map(); // Pour les notifications en temps réel
  }

  /**
   * Ajoute une connexion WebSocket pour un utilisateur
   */
  addWebSocketConnection(userId, socket) {
    this.webSocketConnections.set(userId.toString(), socket);
    console.log(`🔗 WebSocket connecté pour l'utilisateur ${userId}`);
    
    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      this.webSocketConnections.delete(userId.toString());
      console.log(`🔌 WebSocket déconnecté pour l'utilisateur ${userId}`);
    });
  }

  /**
   * Crée une nouvelle notification
   */
  async createNotification(notificationData) {
    try {
      const {
        userId,
        userModel, // 'Client' ou 'ServiceProvider'
        type,
        title,
        message,
        data = {},
        priority = 'medium',
        expiresAt
      } = notificationData;

      // 📝 Création de la notification
      const notification = new Notification({
        userId,
        userModel,
        type,
        title,
        message,
        data,
        priority,
        expiresAt: expiresAt || this.calculateExpiryDate(type),
        status: 'unread'
      });

      await notification.save();
      
      // 🔔 Envoi en temps réel via WebSocket si connecté
      await this.sendRealTimeNotification(userId, notification);
      
      console.log(`✅ Notification créée pour ${userModel} ${userId}`);
      return notification;
      
    } catch (error) {
      console.error('❌ Erreur création notification:', error);
      throw error;
    }
  }

  /**
   * Récupère les notifications d'un utilisateur
   */
  async getUserNotifications(userId, userModel, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly = false,
        type,
        since
      } = options;

      const query = { userId, userModel };
      
      if (unreadOnly) query.status = 'unread';
      if (type) query.type = type;
      if (since) query.createdAt = { $gte: new Date(since) };

      const notifications = await Notification.find(query)
        .sort({ createdAt: -1, priority: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({ 
        userId, userModel, status: 'unread' 
      });

      return {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        },
        unreadCount
      };
      
    } catch (error) {
      console.error('❌ Erreur récupération notifications:', error);
      throw error;
    }
  }

  /**
   * Marque une notification comme lue
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { status: 'read', readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification non trouvée');
      }

      return notification;
    } catch (error) {
      console.error('❌ Erreur marquage notification lue:', error);
      throw error;
    }
  }

  /**
   * Marque toutes les notifications comme lues
   */
  async markAllAsRead(userId, userModel) {
    try {
      const result = await Notification.updateMany(
        { userId, userModel, status: 'unread' },
        { 
          status: 'read',
          readAt: new Date() 
        }
      );

      console.log(`✅ ${result.modifiedCount} notifications marquées comme lues`);
      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      console.error('❌ Erreur marquage notifications lues:', error);
      throw error;
    }
  }

  /**
   * Supprime une notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        userId
      });

      if (!notification) {
        throw new Error('Notification non trouvée');
      }

      return { success: true, message: 'Notification supprimée' };
    } catch (error) {
      console.error('❌ Erreur suppression notification:', error);
      throw error;
    }
  }

  /**
   * Supprime les notifications expirées
   */
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() }
      });

      console.log(`🧹 ${result.deletedCount} notifications expirées supprimées`);
      return result;
    } catch (error) {
      console.error('❌ Erreur nettoyage notifications:', error);
      throw error;
    }
  }

  // 🎯 Méthodes de notification spécifiques

  /**
   * Notification de nouveau contact pour prestataire
   */
  async notifyNewContact(providerId, client, serviceType) {
    return this.createNotification({
      userId: providerId,
      userModel: 'ServiceProvider',
      type: 'new_contact',
      title: 'Nouvelle demande de service 🎯',
      message: `${client.fullName} vous a contacté pour ${serviceType}`,
      data: {
        clientId: client._id,
        clientName: client.fullName,
        serviceType,
        contactDate: new Date()
      },
      priority: 'high'
    });
  }

  /**
   * Notification de confirmation de contact pour client
   */
  async notifyContactConfirmation(clientId, provider, serviceType) {
    return this.createNotification({
      userId: clientId,
      userModel: 'Client',
      type: 'contact_confirmation',
      title: 'Demande envoyée ✅',
      message: `Votre demande de ${serviceType} a été envoyée à ${provider.fullName}`,
      data: {
        providerId: provider._id,
        providerName: provider.fullName,
        serviceType,
        expectedResponse: 'sous 24 heures'
      },
      priority: 'medium'
    });
  }

  /**
   * Notification de nouveau avis
   */
  async notifyNewReview(providerId, client, rating, comment) {
    return this.createNotification({
      userId: providerId,
      userModel: 'ServiceProvider',
      type: 'new_review',
      title: 'Nouvel avis reçu ⭐',
      message: `${client.fullName} vous a noté ${rating}/5 ${comment ? 'avec un commentaire' : ''}`,
      data: {
        clientId: client._id,
        clientName: client.fullName,
        rating,
        comment,
        reviewDate: new Date()
      },
      priority: 'medium'
    });
  }

  /**
   * Notification de classement hebdomadaire
   */
  async notifyWeeklyRanking(providerId, ranking, category, improvement) {
    return this.createNotification({
      userId: providerId,
      userModel: 'ServiceProvider',
      type: 'weekly_ranking',
      title: `Classement hebdomadaire 🏆`,
      message: `Vous êtes #${ranking} en ${category} ${improvement ? `(+${improvement})` : ''}`,
      data: {
        ranking,
        category,
        improvement,
        week: new Date().toISOString().slice(0, 10)
      },
      priority: 'medium'
    });
  }

  /**
   * Notification de badge débloqué
   */
  async notifyBadgeUnlocked(providerId, badgeName, level) {
    return this.createNotification({
      userId: providerId,
      userModel: 'ServiceProvider',
      type: 'badge_unlocked',
      title: 'Nouveau badge débloqué 🎖️',
      message: `Félicitations ! Vous avez débloqué le badge "${badgeName}" (${level})`,
      data: {
        badgeName,
        level,
        unlockedAt: new Date()
      },
      priority: 'low'
    });
  }

  /**
   * Notification d'abonnement activé
   */
  async notifySubscriptionActivated(userId, userModel, planType, endDate) {
    return this.createNotification({
      userId,
      userModel,
      type: 'subscription_activated',
      title: 'Abonnement activé 🎊',
      message: `Votre abonnement ${planType} est maintenant actif jusqu'au ${endDate.toLocaleDateString('fr-FR')}`,
      data: {
        planType,
        endDate,
        activatedAt: new Date()
      },
      priority: 'high'
    });
  }

  /**
   * Notification d'expiration d'abonnement
   */
  async notifySubscriptionExpiring(userId, userModel, planType, daysLeft) {
    return this.createNotification({
      userId,
      userModel,
      type: 'subscription_expiring',
      title: 'Abonnement expirant bientôt ⏰',
      message: `Votre abonnement ${planType} expire dans ${daysLeft} jour(s)`,
      data: {
        planType,
        daysLeft,
        expiryDate: new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000)
      },
      priority: 'high',
      expiresAt: new Date(Date.now() + daysLeft * 24 * 60 * 60 * 1000)
    });
  }

  /**
   * Notification de promotion spéciale
   */
  async notifyPromotion(userId, userModel, promotion) {
    return this.createNotification({
      userId,
      userModel,
      type: 'promotion',
      title: promotion.title,
      message: promotion.message,
      data: {
        promotionId: promotion._id,
        discount: promotion.discount,
        validUntil: promotion.validUntil
      },
      priority: 'medium',
      expiresAt: promotion.validUntil
    });
  }

  /**
   * Notification système (maintenance, nouvelles fonctionnalités, etc.)
   */
  async notifySystemMessage(users, title, message, importance = 'medium') {
    const notifications = [];
    
    for (const user of users) {
      try {
        const notification = await this.createNotification({
          userId: user._id,
          userModel: user.constructor.modelName,
          type: 'system',
          title,
          message,
          data: {
            system: true,
            importance
          },
          priority: importance === 'high' ? 'high' : 'medium'
        });
        notifications.push(notification);
      } catch (error) {
        console.error(`❌ Erreur notification système pour ${user._id}:`, error);
      }
    }

    return {
      total: users.length,
      successful: notifications.length,
      failed: users.length - notifications.length
    };
  }

  // 🔔 Méthodes de notification en temps réel

  /**
   * Envoi de notification en temps réel via WebSocket
   */
  async sendRealTimeNotification(userId, notification) {
    try {
      const socket = this.webSocketConnections.get(userId.toString());
      
      if (socket) {
        socket.emit('new_notification', {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          createdAt: notification.createdAt,
          priority: notification.priority
        });
        
        console.log(`📡 Notification temps réel envoyée à l'utilisateur ${userId}`);
        return true;
      }
      
      return false; // Utilisateur non connecté en temps réel
    } catch (error) {
      console.error('❌ Erreur notification temps réel:', error);
      return false;
    }
  }

  /**
   * Diffusion à plusieurs utilisateurs
   */
  async broadcastToUsers(userIds, notificationData) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const notification = await this.createNotification({
          ...notificationData,
          userId
        });
        results.push({ userId, success: true, notification });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }

    return {
      total: userIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    };
  }

  // 📊 Méthodes d'analyse et statistiques

  /**
   * Statistiques des notifications
   */
  async getNotificationStats(userId, userModel, period = '30days') {
    const startDate = this.getPeriodStartDate(period);
    
    const stats = await Notification.aggregate([
      {
        $match: {
          userId: userId,
          userModel: userModel,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$status', 'unread'] }, 1, 0] }
          },
          read: {
            $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
          }
        }
      }
    ]);

    const totalStats = await Notification.aggregate([
      {
        $match: {
          userId: userId,
          userModel: userModel,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: { $cond: [{ $eq: ['$status', 'unread'] }, 1, 0] }
          },
          read: {
            $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
          }
        }
      }
    ]);

    return {
      period,
      startDate,
      byType: stats,
      total: totalStats[0] || { total: 0, unread: 0, read: 0 }
    };
  }

  /**
   * Taux d'engagement des notifications
   */
  async getEngagementStats(userId, userModel) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const engagement = await Notification.aggregate([
      {
        $match: {
          userId: userId,
          userModel: userModel,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          sent: { $sum: 1 },
          read: {
            $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    const totalSent = engagement.reduce((sum, day) => sum + day.sent, 0);
    const totalRead = engagement.reduce((sum, day) => sum + day.read, 0);
    const readRate = totalSent > 0 ? (totalRead / totalSent * 100).toFixed(1) : 0;

    return {
      period: '30days',
      totalSent,
      totalRead,
      readRate: `${readRate}%`,
      dailyBreakdown: engagement
    };
  }

  // 🛠️ Méthodes utilitaires

  /**
   * Calcule la date d'expiration selon le type
   */
  calculateExpiryDate(type) {
    const expiryRules = {
      'promotion': 7 * 24 * 60 * 60 * 1000, // 7 jours
      'system': 30 * 24 * 60 * 60 * 1000, // 30 jours
      'subscription_expiring': 15 * 24 * 60 * 60 * 1000, // 15 jours
      'default': 90 * 24 * 60 * 60 * 1000 // 90 jours
    };

    const expiryMs = expiryRules[type] || expiryRules.default;
    return new Date(Date.now() + expiryMs);
  }

  /**
   * Calcule la date de début pour les périodes
   */
  getPeriodStartDate(period) {
    const now = new Date();
    
    switch (period) {
      case '7days':
        return new Date(now.setDate(now.getDate() - 7));
      case '30days':
        return new Date(now.setDate(now.getDate() - 30));
      case '90days':
        return new Date(now.setDate(now.getDate() - 90));
      case '1year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
      default:
        return new Date(now.setDate(now.getDate() - 30));
    }
  }

  /**
   * Formatage des priorités
   */
  formatPriority(priority) {
    const priorities = {
      'low': { label: 'Basse', color: 'blue' },
      'medium': { label: 'Moyenne', color: 'orange' },
      'high': { label: 'Haute', color: 'red' }
    };
    return priorities[priority] || priorities.medium;
  }

  /**
   * Nettoyage automatique des anciennes notifications
   */
  async startCleanupJob() {
    // 🕒 Exécution quotidienne à 2h du matin
    setInterval(async () => {
      try {
        await this.cleanupExpiredNotifications();
        
        // Suppression des notifications lues de plus de 90 jours
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        await Notification.deleteMany({
          status: 'read',
          createdAt: { $lt: ninetyDaysAgo }
        });
        
        console.log('🧹 Nettoyage automatique des notifications terminé');
      } catch (error) {
        console.error('❌ Erreur nettoyage automatique:', error);
      }
    }, 24 * 60 * 60 * 1000); // Toutes les 24 heures
  }
}

module.exports = new NotificationService();