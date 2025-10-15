const express = require('express');
const { createProjet, getUserProjets, getOneProjet, updateProjetCode,updateProjetName, deleteProjet } = require('../controllers/projetController');
const router = express.Router();

// Routes pour les projets
router.post('/createProjet', createProjet);
router.get('/getUserProjets', getUserProjets);
router.get('/getOne/:projetId', getOneProjet);
router.put('/updateProjetName/:projetId', updateProjetName);
router.put('/updateProjetCode/:projetId', updateProjetCode);
router.delete('/deleteProjet/:projetId', deleteProjet);

module.exports = router;
