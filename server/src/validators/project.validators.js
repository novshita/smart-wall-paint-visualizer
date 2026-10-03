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

// ---- Project editing (selections, styles, variants) ----

const MAX_VARIANTS = 10;
const MAX_REGIONS = 20;
const MAX_POLYGON_POINTS = 500;
const MAX_STROKES = 400;
const MAX_STROKE_POINTS = 2000;

const id = Joi.string()
  .trim()
  .min(1)
  .max(64)
  .pattern(/^[A-Za-z0-9_-]+$/);
const objectId = Joi.string().hex().length(24);
// Normalised coordinate; brush strokes may run slightly past the image edge
const coord = Joi.number().min(-0.25).max(1.25);
const point = Joi.array().ordered(coord.required(), coord.required()).length(2);

const stroke = Joi.object({
  mode: Joi.string().valid('add', 'erase').required(),
  size: Joi.number().min(0.0005).max(0.5).required(),
  points: Joi.array().items(point).min(1).max(MAX_STROKE_POINTS).required(),
});

const selection = Joi.object({
  type: Joi.string().valid('polygon', 'mask').required(),
  points: Joi.array().items(point).min(3).max(MAX_POLYGON_POINTS),
  strokes: Joi.array().items(stroke).max(MAX_STROKES),
  feather: Joi.number().min(0).max(50).default(0),
});

const style = Joi.object({
  mode: Joi.string().valid('solid', 'dual', 'pattern').default('solid'),
  colorId: objectId,
  secondaryColorId: objectId,
  customHex: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
  patternId: objectId,
  split: Joi.object({
    direction: Joi.string().valid('horizontal', 'vertical'),
    position: Joi.number().min(0).max(100),
  }),
  opacity: Joi.number().min(0).max(100),
  brightness: Joi.number().min(-100).max(100),
  finish: Joi.string().valid('matte', 'satin', 'glossy'),
  patternScale: Joi.number().min(0.1).max(10),
  patternRotation: Joi.number().min(-360).max(360),
});

const region = Joi.object({
  regionId: id.required(),
  name: Joi.string().trim().max(100).allow(''),
  selection: selection.required(),
  style: style.default({}),
});

const variant = Joi.object({
  variantId: id.required(),
  name: Joi.string().trim().max(100).allow(''),
  regions: Joi.array().items(region).max(MAX_REGIONS).unique('regionId').default([]),
});

const updateProject = Joi.object({
  title: Joi.string().trim().max(150).allow(''),
  status: Joi.string().valid('draft', 'saved'),
  variants: Joi.array().items(variant).min(1).max(MAX_VARIANTS).unique('variantId'),
}).min(1);

module.exports.updateProject = updateProject;
module.exports.LIMITS = {
  MAX_VARIANTS,
  MAX_REGIONS,
  MAX_POLYGON_POINTS,
  MAX_STROKES,
  MAX_STROKE_POINTS,
};
