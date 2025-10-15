// middlewares/auth.js
const jwt = require('jsonwebtoken');
const Client = require('../models/client.model');
const ServiceProvider = require('../models/serviceProvider.model');

/**
 * Middleware pour authentifier Client ou ServiceProvider
 */
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token d'authentification manquant",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Chercher l'utilisateur selon le modèle indiqué dans le token ou par ID
    let user;
    let model;

    if (decoded.model === 'ServiceProvider') {
      user = await ServiceProvider.findById(decoded.id).select('-password');
      model = 'ServiceProvider';
    } else if (decoded.model === 'Client') {
      user = await Client.findById(decoded.id).select('-password');
      model = 'Client';
    } else {
      // fallback: chercher dans les deux collections
      user = await Client.findById(decoded.id).select('-password');
      if (user) {
        model = 'Client';
      } else {
        user = await ServiceProvider.findById(decoded.id).select('-password');
        model = 'ServiceProvider';
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    // Normaliser l'objet user
    req.user = {
      id: user._id.toString(),
      model,
      role: user.role || 'user',
      data: user, // si besoin de tout l'objet utilisateur
    };

    next();
  } catch (error) {
    console.error('❌ Erreur authentification:', error);
    res.status(401).json({
      success: false,
      message: 'Token invalide',
    });
  }
};

/**
 * Middleware pour autoriser l'accès selon le rôle
 * @param {Array} roles Liste des rôles autorisés
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié',
      });
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
