const { Color } = require('../models');
const ApiError = require('../utils/api-error');
const colorService = require('../services/color.service');
const { importColors } = require('../services/color-import.service');
const { escapeRegex } = require('../utils/regex');
const { hexToRgb } = require('../utils/color');

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

// ---------- admin (FR-AD1, FR-AD3) ----------

/** Admin list including deactivated colours. */
async function adminList(req, res) {
  const { q, family, status, page, limit } = req.query;
  const filter = {};
  if (status !== 'all') filter.isActive = status === 'active';
  if (family) filter.family = family;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { code: rx }, { hex: rx }];
  }
  const [items, total] = await Promise.all([
    Color.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v')
      .lean(),
    Color.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function create(req, res) {
  if (await Color.exists({ code: req.body.code })) {
    throw ApiError.conflict(`A colour with code ${req.body.code} already exists`);
  }
  const color = await Color.create(req.body);
  res.status(201).json({ color });
}

async function update(req, res) {
  const color = await Color.findById(req.params.id);
  if (!color) throw ApiError.notFound('Colour not found');
  if (
    req.body.code &&
    req.body.code !== color.code &&
    (await Color.exists({ code: req.body.code }))
  ) {
    throw ApiError.conflict(`A colour with code ${req.body.code} already exists`);
  }
  Object.assign(color, req.body);
  if (req.body.hex) color.rgb = hexToRgb(req.body.hex);
  await color.save();
  res.json({ color });
}

/** Soft delete: hidden from users, but designs that used it keep working. */
async function remove(req, res) {
  const color = await Color.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { returnDocument: 'after' },
  );
  if (!color) throw ApiError.notFound('Colour not found');
  res.json({ color });
}

/** Bulk import from an uploaded CSV/JSON file or a JSON body (`{ colors: [...] }`). */
async function importFile(req, res) {
  let content;
  let format;
  if (req.file) {
    content = req.file.buffer.toString('utf8');
    format =
      /\.json$/i.test(req.file.originalname) || content.trim().startsWith('[') ? 'json' : 'csv';
  } else if (Array.isArray(req.body?.colors)) {
    content = JSON.stringify(req.body.colors);
    format = 'json';
  } else {
    throw ApiError.badRequest('Upload a CSV or JSON file in the "file" field.');
  }
  res.json(await importColors(content, format));
}

module.exports = { list, facets, getById, adminList, create, update, remove, importFile };
