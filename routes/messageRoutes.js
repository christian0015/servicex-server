// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate, authorize } = require('../middlewares/auth');

// 🔐 Toutes les routes nécessitent une authentification
router.use(authenticate);

// 🗨️ Conversations
router.post('/conversations', messageController.getOrCreateConversation);
router.get('/conversations', messageController.getUserConversations);
router.put('/conversations/:conversationId/archive', messageController.archiveConversation);

// 📨 Messages
router.post('/messages', messageController.sendMessage);
router.get('/conversations/:conversationId/messages', messageController.getConversationMessages);
router.get('/messages/search', messageController.searchMessages);

// 🔢 Statistiques
router.get('/conversations/unread/count', messageController.getUnreadCount);

module.exports = router;