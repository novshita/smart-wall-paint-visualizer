const ApiError = require('../utils/api-error');
const { verifyAccessToken } = require('../utils/jwt');
const { User } = require('../models');

/**
 * Requires a valid `Authorization: Bearer <jwt>` header. Loads the user on every
 * request so deactivation, role changes and password changes take effect immediately.
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized());
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token';
    return next(ApiError.unauthorized(message));
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    return next(ApiError.unauthorized('Account not found or deactivated'));
  }
  if ((payload.ver ?? 0) !== user.tokenVersion) {
    return next(ApiError.unauthorized('Session expired, please log in again'));
  }

  req.user = user;
  next();
}

/** Restricts a route to the given roles. Use after `authenticate`. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
