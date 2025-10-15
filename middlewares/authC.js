const jwt = require('jsonwebtoken');
const Client = require('../models/client.model');
const ServiceProvider = require('../models/serviceProvider.model');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Chercher dans Client ou ServiceProvider
    let user = await Client.findById(decoded.userId);
    let userModel = 'Client';
    
    if (!user) {
      user = await ServiceProvider.findById(decoded.userId);
      userModel = 'ServiceProvider';
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    req.user = user;
    req.user.model = userModel;
    next();
    
  } catch (error) {
    console.error('❌ Erreur authentification:', error);
    res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }
    
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }
    
    next();
  };
};

module.exports = { authenticate, authorize };