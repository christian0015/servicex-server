// controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Client = require('../models/client.model');
const ServiceProvider = require('../models/serviceProvider.model');

// 🔹 Utilitaire pour générer un JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      model: user instanceof ServiceProvider ? 'ServiceProvider' : 'Client',
      role: user.role || 'user'
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// 🔹 Envoi e-mail confirmation
const sendConfirmationEmail = async (user, token) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const url = `${process.env.FRONTEND_URL}/confirm-email?token=${token}`;

  await transporter.sendMail({
    from: `"Le Secret" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: "Confirmation de votre e-mail",
    html: `<p>Bonjour ${user.fullName},</p>
           <p>Merci de vous être inscrit. Veuillez confirmer votre adresse e-mail en cliquant sur le lien suivant :</p>
           <a href="${url}">Confirmer mon e-mail</a>`
  });
};

// 🔹 Inscription
const register = async (req, res) => {
  try {
    const { phoneNumber, password, model, fullName, email, zones, preferredZones } = req.body;
    console.log( "Info Inscription: ",phoneNumber, password, model, fullName, email, zones, preferredZones);
    

    if (!phoneNumber || !password || !model) {
      return res.status(400).json({ success: false, message: 'Données manquantes' });
    }

    let UserModel = model === 'ServiceProvider' ? ServiceProvider : Client;

    // Chercher si user existe déjà
    let user = await UserModel.findOne({ phoneNumber });
    console.log("num client: ", user?.phoneNumber, user?.password, user?.model, user?.fullName, user?.email, user?.preferredZones);
    

    if (user) {
      // Vérifier mot de passe
      const isMatch = await bcrypt.compare(password, user?.password);
      if (isMatch) {
        // Si mot de passe correct → on renvoie comme un login
        const token = generateToken({ ...user.toObject(), model });
        return res.status(200).json({ success: true, message: 'Connexion réussie', token, user });
      } else {
        // Si mot de passe incorrect → bloquer
        return res.status(400).json({ success: false, message: 'Numéro déjà utilisé' });
      }
    }

    // Si user n'existe pas → créer
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("hash pass: ", hashedPassword);
    

    user = new UserModel({
      phoneNumber,
      password: hashedPassword,
      fullName,
      email,
      model,
      ...(zones
    ? model === 'ServiceProvider'
      ? { zones }
      : { preferredZones: zones }
    : {}),
    });

    await user.save();

    // Envoi mail de confirmation
    if (email) {
      // sendConfirmationEmail(email, fullName); // ta fonction d'envoi
    }

    const token = generateToken({ ...user.toObject(), model });

    return res.status(201).json({ success: true, message: 'Inscription réussie', token, user });
  } catch (error) {
    console.error('❌ authController.registerOrLogin error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// 🔹 Connexion
const login = async (req, res) => {
  try {
    const { phoneNumber, password, model } = req.body;
    console.log("Info Login :", phoneNumber, password, model);
    
    if (!phoneNumber || !password || !model)
      return res.status(400).json({ success: false, message: 'Champs requis manquants' });

    let UserModel;
    if (model === 'Client') UserModel = Client;
    else if (model === 'ServiceProvider') UserModel = ServiceProvider;
    else return res.status(400).json({ success: false, message: 'Model invalide' });

    const user = await UserModel.findOne({ phoneNumber });
    if (!user) return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Mot de passe incorrect' });

    if (user.isConfirmed === false)
      return res.status(403).json({ success: false, message: 'Veuillez confirmer votre e-mail' });

    const token = generateToken(user);
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          email: user.email,
          model
        }
      }
    });
  } catch (error) {
    console.error('❌ Auth login error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};


// 🔹 Confirmation e-mail
const confirmEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Token manquant' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user;

    if (decoded.model === 'Client') user = await Client.findById(decoded.id);
    else if (decoded.model === 'ServiceProvider') user = await ServiceProvider.findById(decoded.id);

    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    user.isConfirmed = true;
    await user.save();

    res.json({ success: true, message: 'E-mail confirmé avec succès !' });
  } catch (error) {
    console.error('❌ Confirm email error:', error);
    res.status(400).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

// 🔹 Mot de passe oublié (envoi lien e-mail)
const forgotPassword = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, message: 'Numéro requis' });

    let user = await Client.findOne({ phoneNumber }) || await ServiceProvider.findOne({ phoneNumber });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    const resetToken = jwt.sign({ id: user._id.toString(), model: user instanceof ServiceProvider ? 'ServiceProvider' : 'Client' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const url = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    await transporter.sendMail({
      from: `"Le Secret" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Réinitialisation de mot de passe",
      html: `<p>Bonjour ${user.fullName},</p><p>Cliquez sur le lien pour réinitialiser votre mot de passe :</p><a href="${url}">Réinitialiser mon mot de passe</a>`
    });

    res.json({ success: true, message: 'Lien de réinitialisation envoyé par e-mail' });
  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// 🔹 Réinitialisation mot de passe
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Champs requis manquants' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    let user;

    if (decoded.model === 'Client') user = await Client.findById(decoded.id);
    else if (decoded.model === 'ServiceProvider') user = await ServiceProvider.findById(decoded.id);

    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès !' });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(400).json({ success: false, message: 'Token invalide ou expiré' });
  }
};

module.exports = {
  register,
  login,
  confirmEmail,
  forgotPassword,
  resetPassword
};
