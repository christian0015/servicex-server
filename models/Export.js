// models/Export.js
const mongoose = require('mongoose');

const ExportSchema = new mongoose.Schema({
  projet: { type: mongoose.Schema.Types.ObjectId, ref: 'Projet', required: true, unique: true },
  exportKey: { type: String, required: true, unique: true },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'digiliaExports' }); // Nom de collection avec préfixe);

module.exports = mongoose.model('Export', ExportSchema);
