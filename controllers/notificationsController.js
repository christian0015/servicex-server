const notificationService = require('../services/notifications/notificationService');
const emailService = require('../services/notifications/emailService');

class NotificationsController {
  // 🔔 Notifications utilisateur
  async getUserNotifications(req, res) {
    try {
      const userId = req.user.id;
      const userModel = req.user.model; // 'Client' ou 'ServiceProvider'
      const { page, limit, unreadOnly, type, since } = req.query;

      const result = await notificationService.getUserNotifications(userId, userModel, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        unreadOnly: unreadOnly === 'true',
        type,
        since
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getNotificationStats(req, res) {
    try {
      const userId = req.user.id;
      const userModel = req.user.model;
      const { period } = req.query;

      const stats = await notificationService.getNotificationStats(userId, userModel, period);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async getEngagementStats(req, res) {
    try {
      const userId = req.user.id;
      const userModel = req.user.model;

      const stats = await notificationService.getEngagementStats(userId, userModel);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const notification = await notificationService.markAsRead(id, userId);

      res.json({
        success: true,
        data: notification
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const userModel = req.user.model;

      const result = await notificationService.markAllAsRead(userId, userModel);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await notificationService.deleteNotification(id, userId);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // 📧 Services email
  async sendEmail(req, res) {
    try {
      const { to, subject, template, data } = req.body;

      const result = await emailService.sendEmail({
        to,
        subject,
        template,
        data
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async sendWelcomeEmail(req, res) {
    try {
      const { userId, userType } = req.body;
      
      // 🎯 Récupération des données utilisateur
      const UserModel = userType === 'client' ? require('../models/client.model') : require('../models/serviceProvider.model');
      const user = await UserModel.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      const result = await emailService.sendWelcomeEmail(user, userType);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async sendContactNotification(req, res) {
    try {
      const { providerId, clientId, serviceType } = req.body;

      const [provider, client] = await Promise.all([
        require('../models/serviceProvider.model').findById(providerId),
        require('../models/client.model').findById(clientId)
      ]);

      if (!provider || !client) {
        return res.status(404).json({
          success: false,
          message: 'Prestataire ou client non trouvé'
        });
      }

      // 🔔 Notification en temps réel
      await notificationService.notifyNewContact(providerId, client, serviceType);
      
      // 📧 Email au prestataire
      const emailResult = await emailService.sendNewContactNotification(provider, client, serviceType);

      res.json({
        success: true,
        notification: true,
        email: emailResult
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async sendSubscriptionEmail(req, res) {
    try {
      const { userId, userModel, planType, endDate } = req.body;

      const UserModel = userModel === 'Client' ? 
        require('../models/client.model') : 
        require('../models/serviceProvider.model');
      
      const user = await UserModel.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      const result = await emailService.sendSubscriptionNotification(
        user, 
        planType, 
        new Date(endDate)
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // 🔧 Administration
  async broadcastNotification(req, res) {
    try {
      const { userIds, userModel, title, message, data } = req.body;

      const result = await notificationService.broadcastToUsers(userIds, {
        userModel,
        type: 'system',
        title,
        message,
        data,
        priority: 'medium'
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async sendSystemNotification(req, res) {
    try {
      const { userType, title, message, importance } = req.body;

      let users;
      if (userType === 'all') {
        const [clients, providers] = await Promise.all([
          require('../models/client.model').find().select('_id'),
          require('../models/serviceProvider.model').find().select('_id')
        ]);
        users = [...clients, ...providers];
      } else {
        const Model = userType === 'client' ? 
          require('../models/client.model') : 
          require('../models/serviceProvider.model');
        users = await Model.find().select('_id');
      }

      const result = await notificationService.notifySystemMessage(
        users, 
        title, 
        message, 
        importance
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  async cleanupExpired(req, res) {
    try {
      const result = await notificationService.cleanupExpiredNotifications();

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // 🌐 WebSocket connection
  async handleWebSocketConnection(socket, userId) {
    notificationService.addWebSocketConnection(userId, socket);
    
    // Écoute des événements client
    socket.on('mark_notification_read', async (data) => {
      try {
        await notificationService.markAsRead(data.notificationId, userId);
        socket.emit('notification_marked_read', { success: true });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
  }
}

module.exports = new NotificationsController();