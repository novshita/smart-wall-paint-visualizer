const Joi = require('joi');
const { pagination } = require('./common.validators');

const listColors = Joi.object({
  q: Joi.string().trim().max(50).allow(''),
  family: Joi.string().trim().max(50),
  brand: Joi.string().trim().max(50),
  finish: Joi.string().valid('matte', 'satin', 'glossy'),
  tag: Joi.string().trim().max(50),
  sort: Joi.string().valid('family', 'name', 'code').default('family'),
  // Comma-separated ids, e.g. to resolve the colours used in a design
  ids: Joi.string()
    .pattern(/^[0-9a-f]{24}(,[0-9a-f]{24}){0,99}$/i)
    .messages({ 'string.pattern.base': 'ids must be up to 100 comma-separated colour ids' }),
  ...pagination,
});

const listPatterns = Joi.object({
  q: Joi.string().trim().max(50).allow(''),
  category: Joi.string().trim().max(50),
  ...pagination,
});

module.exports = { listColors, listPatterns };
