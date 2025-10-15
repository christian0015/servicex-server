const jwt = require('jsonwebtoken');
const ServiceProvider = require('../models/serviceProvider.model');
const Client = require('../models/client.model');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification manquant'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Trouver l'utilisateur selon son type
    let user;
    if (decoded.model === 'ServiceProvider') {
      user = await ServiceProvider.findById(decoded.id).select('-password');
    } else if (decoded.model === 'Client') {
      user = await Client.findById(decoded.id).select('-password');
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    req.user = {
      id: user._id.toString(),
      model: decoded.model,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    console.error('❌ Erreur authentification:', error);
    res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
};

module.exports = authMiddleware;