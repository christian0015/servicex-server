const express = require('express');
const DigiliaInfo = require('../models/DigiliaInfo');

const router = express.Router();

// POST Newsletter
router.post('/newsletter', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    const saved = await DigiliaInfo.create({ type: 'newsletter', email });
    return res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST Témoignage
router.post('/temoignage', async (req, res) => {
  try {
    const { name, username, body, img, rating, origin } = req.body;

    if (!name || !username || !body) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const saved = await DigiliaInfo.create({
      type: 'temoignage',
      name,
      username,
      body,
      img: img || 'https://avatar.vercel.sh/anonymous',
      rating: rating || 5,
      origin,
    });

    return res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET (admin) : récupérer toutes les infos
router.get('/', async (req, res) => {
  try {
    const infos = await DigiliaInfo.find().sort({ createdAt: -1 });
    return res.status(200).json(infos);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
