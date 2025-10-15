const User = require('../models/User');
const Projet = require('../models/Projet');
const Export = require('../models/Export');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');

// Connexion
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Utilisateur introuvable' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mot de passe incorrect' });
    }

    const token = generateToken(user._id, '2d'); // Expiration 2 jours);
    const { password: _, ...userWithoutPassword } = user.toObject();
    // Ajouter le token dans l'objet user
    userWithoutPassword.token = token;
    res.json({ token, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Inscription
exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {

      const isMatch = await bcrypt.compare(password, existingUser.password);
        if (isMatch) {
          const token = generateToken(existingUser._id, '2d'); // Expiration 2 jours);
          const { password: _, ...userWithoutPassword } = existingUser.toObject();
          // Ajouter le token dans l'objet existingUser
          userWithoutPassword.token = token;
          return res.json({ token, user: userWithoutPassword });
        }

      return res.status(400).json({ message: 'Cet email est déjà utilisé. Essayez de vous connecter.' });
    }

    // Hasher le mot de passe avant de créer l'utilisateur
    const hashedPassword = await bcrypt.hash(password, 10); // 10 est le facteur de coût pour bcrypt

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = generateToken(user._id, '2d'); // Expiration 2 jours);
    res.status(201).json({
      message: 'Inscription réussie.',
      user: { _id: user._id, username: user.username, email: user.email, role: user.role, token: token },
      token,
    });
  } catch (error) {
    // 👇 Ici on gère le cas MongoDB duplicate key
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Erreur lors de l’inscription.',
        error: 'Cet email ou nom d’utilisateur est déjà utilisé.',
      });
    }
    res.status(500).json({ message: 'Erreur lors de l’inscription.', error });
  }
};

// Mise à jour du profil
exports.update = async (req, res) => {
  // const userId = req.body._id;
  // const username = req.body.username;
  // const email = req.body.email;
  // const password = req.body.password;
  const { _id: userId, username, email, password } = req.body; // Ajoutez password ici

  
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    const token = generateToken(user._id, '2d'); // Expiration 2 jours);

    res.status(200).json({
      message: 'Profille mis à jour avec succès',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
      token,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour du profil', error });
  }
};

// Suppression du compte
exports.delete = async (req, res) => {
  const userId = req.params.userId;

  try {
    // 1. Récupérer tous les projets de l'utilisateur
    const projets = await Projet.find({ user: userId });

    // 2. Extraire les IDs des projets
    const projetIds = projets.map(p => p._id);

    // 3. Supprimer tous les exports liés aux projets de l'utilisateur
    await Export.deleteMany({ projet: { $in: projetIds } });

    // 4. Supprimer les projets
    await Projet.deleteMany({ user: userId });

    // 5. Supprimer l'utilisateur
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'Compte et toutes les données associées supprimés avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression du compte', error });
  }
};
