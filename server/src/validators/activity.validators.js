const Joi = require('joi');
const { objectId } = require('./common.validators');

// Events the browser may report. Server-side events (login, upload, save…) are logged by the API itself.
const logEvent = Joi.object({
  action: Joi.string().valid('download', 'session_start', 'session_end').required(),
  projectId: objectId,
  sessionId: Joi.string()
    .trim()
    .max(64)
    .pattern(/^[A-Za-z0-9_-]+$/),
  metadata: Joi.object({
    format: Joi.string().valid('png', 'jpg'),
    layout: Joi.string().valid('painted', 'before-after'),
    durationSeconds: Joi.number().min(0).max(86400),
  }),
});

module.exports = { logEvent };
