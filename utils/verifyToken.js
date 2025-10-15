// utils/verifyToken.js
const jwt = require('jsonwebtoken');

const decodeToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET).userId; // Même secret que pour generateToken
};

module.exports = decodeToken;
