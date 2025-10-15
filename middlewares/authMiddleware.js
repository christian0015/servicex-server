const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

// Middleware d'authentification
const authMiddleware = async (req, res, next) => {

  // Récupère les données utilisateur de l'en-tête (si envoyé)
  // const userHeader = req.header('User');console.log('userHeader:', userHeader);
  // const userFromHeader = userHeader ? JSON.parse(userHeader) : null;
  // console.log('User Data from Header:', userFromHeader);


  // Récupère le token de l'en-tête Authorization
  // console.log('Authorization Header:', req.header('Authorization'));
  // const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2NmI3Mzk4MzExZGI5YWJhZjEwOWUzZGUiLCJpYXQiOjE3MjMyODQwMzV9.ryjGtvm1VkMJnsA2MWCkABCk9wOjc1qJiQcRhtMwr_o';
  const token = req.header('Authorization') ? req.header('Authorization').replace('Bearer ', '') : null;
  console.log('Token:', token); // Log le token pour vérifier sa présence

  if (!token) { 
    // console.log('Token n"est pas:', token);
    return res.status(401).send({ error: 'No token provided.' });
  }

  try {
    // Vérifie et décode le token
    const decoded = jwt.verify(token, config.jwtSecret);
    console.log('Decoded Token:', decoded); // Log le token décodé pour vérifier son contenu

    // Trouve l'utilisateur correspondant au token
    const user = await User.findOne({ _id: decoded._id });
    console.log('User:', user); // Log l'utilisateur trouvé pour vérifier les détails

    if (!user) {
      throw new Error('User not found.');
    }

    req.user = user; // Attache l'utilisateur à la requête
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

// Middleware pour les routes administratives
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).send({ error: 'Access denied.' });
  }
  next();
};

// Middleware pour les routes réservées aux admins et aux gérants
const gerantMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'gerant') {
    return res.status(403).send({ error: 'Access denied.' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware, gerantMiddleware };
