const express = require('express');
const router = express.Router();

const notificationsController = require('../controllers/notificationsController');
const { authenticate, authorize } = require('../middlewares/auth');

// Appliquer l'authentification à toutes les routes
router.use(authenticate);

// 🔔 Notifications
router.get('/', notificationsController.getUserNotifications);
router.get('/stats', notificationsController.getNotificationStats);
router.get('/engagement', notificationsController.getEngagementStats);
router.put('/read/:id', notificationsController.markAsRead);
router.put('/read-all', notificationsController.markAllAsRead);
router.delete('/:id', notificationsController.deleteNotification);

// 📧 Emails
router.post('/email/send', notificationsController.sendEmail);
router.post('/email/welcome', notificationsController.sendWelcomeEmail);
router.post('/email/contact-notification', notificationsController.sendContactNotification);
router.post('/email/subscription', notificationsController.sendSubscriptionEmail);

// 🔧 Administration
router.post('/broadcast', notificationsController.broadcastNotification);
router.post('/system', notificationsController.sendSystemNotification);
router.delete('/cleanup/expired', notificationsController.cleanupExpired);

module.exports = router;