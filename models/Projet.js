const mongoose = require('mongoose');

const projetSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  code: {
    type: String, // Contient le code du projet ou une référence à un fichier
    required: true,
  },
  downloads: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { collection: 'digiliaProjets' }); // Nom de collection avec préfixe

projetSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Projet = mongoose.model('Projet', projetSchema);
module.exports = Projet;
