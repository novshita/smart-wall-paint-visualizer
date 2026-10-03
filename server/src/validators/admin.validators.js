const Joi = require('joi');
const { objectId, pagination } = require('./common.validators');

const FINISHES = ['matte', 'satin', 'glossy'];
const hex = Joi.string()
  .trim()
  .pattern(/^#?[0-9a-fA-F]{6}$/)
  .custom((v) => (v.startsWith('#') ? v : `#${v}`).toUpperCase())
  .messages({ 'string.pattern.base': 'HEX must look like #A7B49A' });
const tag = Joi.string().trim().min(1).max(40);

// ---- colours (FR-AD1) ----
const colorFields = {
  code: Joi.string()
    .trim()
    .uppercase()
    .max(30)
    .pattern(/^[A-Z0-9][A-Z0-9 _-]*$/),
  name: Joi.string().trim().min(1).max(80),
  hex,
  brand: Joi.string().trim().max(60),
  family: Joi.string().trim().min(1).max(40),
  finishes: Joi.array()
    .items(Joi.string().valid(...FINISHES))
    .min(1)
    .unique(),
  tags: Joi.array().items(tag).max(20).unique(),
  isActive: Joi.boolean(),
};

const createColor = Joi.object({
  ...colorFields,
  code: colorFields.code.required(),
  name: colorFields.name.required(),
  hex: colorFields.hex.required(),
  family: colorFields.family.required(),
});

const updateColor = Joi.object(colorFields).min(1);

const listAdminColors = Joi.object({
  q: Joi.string().trim().max(50).allow(''),
  family: Joi.string().trim().max(40),
  status: Joi.string().valid('all', 'active', 'inactive').default('all'),
  ...pagination,
  limit: Joi.number().integer().min(1).max(100).default(25),
});

// ---- patterns (FR-AD2) ----
const patternFields = {
  name: Joi.string().trim().min(1).max(80),
  description: Joi.string().trim().max(500).allow(''),
  category: Joi.string().trim().min(1).max(40),
  isActive: Joi.boolean(),
};
const createPattern = Joi.object({
  ...patternFields,
  name: patternFields.name.required(),
  category: patternFields.category.required(),
});
const updatePattern = Joi.object(patternFields).min(1);
const listAdminPatterns = Joi.object({
  status: Joi.string().valid('all', 'active', 'inactive').default('all'),
  ...pagination,
  limit: Joi.number().integer().min(1).max(100).default(50),
});

// ---- users (FR-AD4) ----
const listUsers = Joi.object({
  q: Joi.string().trim().max(80).allow(''),
  role: Joi.string().valid('user', 'admin'),
  status: Joi.string().valid('active', 'inactive'),
  ...pagination,
  limit: Joi.number().integer().min(1).max(100).default(25),
});
const updateUser = Joi.object({
  role: Joi.string().valid('user', 'admin'),
  isActive: Joi.boolean(),
}).min(1);

// ---- designs & activity (FR-AD5) ----
const listAllProjects = Joi.object({
  q: Joi.string().trim().max(80).allow(''),
  userId: objectId,
  status: Joi.string().valid('draft', 'saved'),
  ...pagination,
  limit: Joi.number().integer().min(1).max(100).default(24),
});

const ACTIONS = [
  'register',
  'login',
  'logout',
  'upload',
  'save',
  'download',
  'delete',
  'session_start',
  'session_end',
];
const listActivity = Joi.object({
  action: Joi.string().valid(...ACTIONS),
  userId: objectId,
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  ...pagination,
  limit: Joi.number().integer().min(1).max(100).default(50),
});

// ---- settings (FR-AD6) ----
const updateSettings = Joi.object({
  maxUploadMb: Joi.number().min(1).max(25),
  allowedFormats: Joi.array().items(Joi.string().valid('image/jpeg', 'image/png')).min(1).unique(),
  defaultFinish: Joi.string().valid(...FINISHES),
  disclaimerText: Joi.string().trim().min(10).max(300),
}).min(1);

// ---- analytics (FR-AD7) ----
const analyticsQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso(),
  days: Joi.number().integer().valid(7, 30, 90).default(30),
});

module.exports = {
  createColor,
  updateColor,
  listAdminColors,
  createPattern,
  updatePattern,
  listAdminPatterns,
  listUsers,
  updateUser,
  listAllProjects,
  listActivity,
  updateSettings,
  analyticsQuery,
  colorFields,
  FINISHES,
};
