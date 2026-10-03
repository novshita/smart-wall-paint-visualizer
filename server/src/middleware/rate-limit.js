const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const common = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: (req, res, next, options) =>
    res.status(options.statusCode).json({
      status: options.statusCode,
      message: 'Too many requests, please try again later',
      errors: [],
    }),
};

const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 1000 });
const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });
const uploadLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 60 });

module.exports = { apiLimiter, authLimiter, uploadLimiter };
