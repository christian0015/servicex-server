// routes/seed.js
const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');

router.post('/generate', seedController.generateFakeData);
router.post('/delete', seedController.deleteFakeData);

module.exports = router;