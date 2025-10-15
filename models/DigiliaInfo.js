const mongoose = require('mongoose');

const digiliaInfoSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['newsletter', 'temoignage'], required: true },

    // Newsletter
    email: { type: String },

    // Témoignages
    name: String,
    username: String,
    body: String,
    img: String,
    rating: Number,
    origin: String,
  },
  { 
    collection: 'digiliaInfo',
    timestamps: true // ajoute createdAt et updatedAt auto
  }
);

const DigiliaInfo = mongoose.model('DigiliaInfo', digiliaInfoSchema);

module.exports = DigiliaInfo;
