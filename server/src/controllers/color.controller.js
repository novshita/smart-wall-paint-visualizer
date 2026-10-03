const { Color } = require('../models');
const ApiError = require('../utils/api-error');
const colorService = require('../services/color.service');

async function list(req, res) {
  res.json(await colorService.listColors(req.query));
}

async function facets(req, res) {
  res.json(await colorService.colorFacets());
}

async function getById(req, res) {
  const color = await Color.findOne({ _id: req.params.id, isActive: true }).select('-__v');
  if (!color) throw ApiError.notFound('Colour not found');
  res.json({ color });
}

module.exports = { list, facets, getById };
