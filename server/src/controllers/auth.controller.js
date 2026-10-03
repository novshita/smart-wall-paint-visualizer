const bcrypt = require('bcryptjs');
const { User } = require('../models');
const ApiError = require('../utils/api-error');
const { signAccessToken } = require('../utils/jwt');
const { logActivity } = require('../services/activity.service');

const BCRYPT_COST = 12;
// Compared against when the email is unknown, so login timing doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', BCRYPT_COST);

function authResponse(user) {
  return { token: signAccessToken(user), user: user.toJSON() };
}

async function register(req, res) {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const user = await User.create({ name, email, passwordHash, lastLoginAt: new Date() });

  await logActivity(user._id, 'register');
  res.status(201).json(authResponse(user));
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated. Please contact support.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  await logActivity(user._id, 'login');
  res.json(authResponse(user));
}

async function logout(req, res) {
  // JWTs are stateless; the client discards the token. We record the event for analytics.
  await logActivity(req.user._id, 'logout');
  res.status(204).end();
}

function me(req, res) {
  res.json({ user: req.user.toJSON() });
}

async function updateMe(req, res) {
  const { name, email } = req.body;

  if (email && email !== req.user.email && (await User.exists({ email }))) {
    throw ApiError.conflict('An account with this email already exists');
  }

  if (name !== undefined) req.user.name = name;
  if (email !== undefined) req.user.email = email;
  await req.user.save();

  res.json({ user: req.user.toJSON() });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', [
      { field: 'currentPassword', message: 'Current password is incorrect' },
    ]);
  }

  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
  user.tokenVersion += 1;
  await user.save();

  // Old tokens are now rejected; hand back a fresh one so this session continues
  res.json(authResponse(user));
}

module.exports = { register, login, logout, me, updateMe, changePassword };
