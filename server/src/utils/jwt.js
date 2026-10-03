const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  const payload = { sub: user._id.toString(), role: user.role, ver: user.tokenVersion ?? 0 };
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn, algorithm: 'HS256' });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret, { algorithms: ['HS256'] });
}

module.exports = { signAccessToken, verifyAccessToken };
