const express = require('express');
const { login, register, update, delete: deleteUser } = require('../controllers/authController');
const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.put('/update', update);
router.delete('/delete/:userId', deleteUser);

module.exports = router;