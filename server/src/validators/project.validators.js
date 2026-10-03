const Joi = require('joi');
const { pagination } = require('./common.validators');

const createProject = Joi.object({
  title: Joi.string().trim().max(150).allow(''),
  // Spec FR-U4 / §23 rule 1: the user must confirm they own the photo
  ownershipConfirmed: Joi.boolean().truthy('true', 'on', '1').valid(true).required().messages({
    'any.only': 'Please confirm that you own this photo or have permission to use it.',
    'any.required': 'Please confirm that you own this photo or have permission to use it.',
  }),
});

const listProjects = Joi.object({
  status: Joi.string().valid('draft', 'saved'),
  ...pagination,
  limit: Joi.number().integer().min(1).max(50).default(12),
});

module.exports = { createProject, listProjects };
