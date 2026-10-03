const Joi = require('joi');

const objectId = Joi.string()
  .hex()
  .length(24)
  .messages({ 'string.hex': 'Invalid id', 'string.length': 'Invalid id' });

const idParam = Joi.object({ id: objectId.required() });

const pagination = {
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(24),
};

module.exports = { objectId, idParam, pagination };
