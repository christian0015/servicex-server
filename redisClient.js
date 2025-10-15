// redisClient.js
const redis = require('redis');

// Création du client Redis
const redisClient = redis.createClient({
  url: 'redis://localhost:6379', // modifie si tu es en production ou avec un Redis distant
});

redisClient.on('error', (err) => {
  console.error('Erreur Redis :', err);
});

redisClient.on('connect', () => {
  console.log('✅ Connecté à Redis');
});

// Connexion manuelle (sinon reste en pending)
(async () => {
  await redisClient.connect();
})();

module.exports = redisClient;
