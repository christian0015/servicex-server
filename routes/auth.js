const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 🔹 Inscription
router.post('/register', authController.register);

// 🔹 Connexion
router.post('/login', authController.login);

// 🔹 Confirmation e-mail
router.get('/confirm-email', authController.confirmEmail);

// 🔹 Mot de passe oublié
router.post('/forgot-password', authController.forgotPassword);

// 🔹 Réinitialisation mot de passe
router.post('/reset-password', authController.resetPassword);

module.exports = router;
