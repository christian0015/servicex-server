const express = require('express');
const app = express();
const mongoose = require('mongoose');
const config = require('./config/config'); // Assure-toi que le chemin est correct
const cors = require('cors');
require('dotenv').config();
app.use(cors());
app.use(cors({
  origin: '*', // ou l'URL correcte du frontend
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

const http = require('http');
const socketIo = require('socket.io');
const server = http.createServer(app);
const io = socketIo(server);

// Connexion à MongoDB
mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => console.log('MongoDB connection error: ', err));

// Middleware
app.use(express.json());





app.use((req, res, next) => {
  console.log('📩 Nouvelle requête reçue:');
  console.log('🧭 Méthode:', req.method);
  console.log('🌍 URL:', req.originalUrl);
  console.log('📦 Body:', req.body);
  console.log('🧩 Query:', req.query);

  // 🔐 Affiche le token complet (si présent)
  if (req.headers.authorization) {
    console.log('🪪 Token:', req.headers.authorization);
  } else {
    console.log('🪪 Token: Aucun');
  }

  console.log('-------------------------------');
  next();
});








// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projets', require('./routes/projet')); // Assurez-vous que le nom de la route est correct

app.use('/api/digilia-info', require('./routes/digiliaInfo'));

const analyticsRoutes = require('./routes/analytics');
// Routes
app.use('/api/analytics', analyticsRoutes);

// Routes
const notificationsRoutes = require('./routes/notifications');
// Routes
app.use('/api/notifications', notificationsRoutes);

app.use('/api/clients', require('./routes/clients'));
app.use('/api/providers', require('./routes/providers'));


// app.js - AJOUT
const messageRoutes = require('./routes/messageRoutes');
// Routes de messagerie
app.use('/api/messages', messageRoutes);

// Dans server.js, ajoutez cette ligne avec les autres routes
app.use('/api/seed', require('./routes/seed'));

// Initialisation des services après connexion DB
mongoose.connection.once('open', async () => {
  console.log('✅ Connecté à MongoDB');
  
  // Lancement initial des classements
  try {
    const rankingService = require('./services/analytics/rankingService');
    await rankingService.updateAllRankings();
    console.log('✅ Classements initiaux générés');
  } catch (error) {
    console.error('❌ Erreur classements initiaux:', error);
  }
});


// 🔗 Configuration WebSocket
io.on('connection', (socket) => {
  console.log('🔗 Nouvelle connexion WebSocket');
  
  // Authentification du socket
  socket.on('authenticate', (token) => {
    try {
      // Vérification du token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const notificationsController = require('./controllers/notificationsController');
      
      // Association utilisateur-socket
      notificationsController.handleWebSocketConnection(socket, decoded.userId);
      
    } catch (error) {
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  });
});

// 🧹 Lancement des jobs automatiques
const notificationService = require('./services/notifications/notificationService');
notificationService.startCleanupJob();



// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    service: 'ServiceX API'
  });
});

// Erreur 404
app.use((req, res, next) => {
  res.status(404).json({ message: 'Resource not found' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
