const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'client'],
    default: 'client',
  },
  subscription: {
    type: {
      type: String,
      enum: ['free', 'basic', 'premium'], // Types d'abonnement disponibles
      default: 'free',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
    },
  },
   // 🔹 Champs pour le suivi des quotas
  dailyGenerations: { // Reset tous les jours à minuit
    type: Number,
    default: 0,
  },
  paidGenerations: { // Reset après expiration de l’abonnement
    type: Number,
    default: 0,
  },
  lastReset: { // <- date dernier reset
    type: Date, 
    default: Date.now 
  }, 
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, { collection: 'digiliaUsers' }); // Nom de collection avec préfixe

userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
