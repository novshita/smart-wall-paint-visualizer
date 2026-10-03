const crypto = require('crypto');
const { Pattern } = require('../models');
const ApiError = require('../utils/api-error');
const { escapeRegex } = require('../utils/regex');
const { processPatternTile } = require('../services/image.service');
const { storage } = require('../services/storage.service');

async function list(req, res) {
  const { q, category, page, limit } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (q) filter.name = new RegExp(escapeRegex(q), 'i');

  const [items, total, categories] = await Promise.all([
    Pattern.find(filter)
      .sort({ category: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v')
      .lean(),
    Pattern.countDocuments(filter),
    Pattern.distinct('category', { isActive: true }),
  ]);

  res.json({
    items,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
    categories: categories.sort(),
  });
}

async function getById(req, res) {
  const pattern = await Pattern.findOne({ _id: req.params.id, isActive: true }).select('-__v');
  if (!pattern) throw ApiError.notFound('Pattern not found');
  res.json({ pattern });
}

// ---------- admin (FR-AD2) ----------

async function adminList(req, res) {
  const { status, page, limit } = req.query;
  const filter = status === 'all' ? {} : { isActive: status === 'active' };
  const [items, total] = await Promise.all([
    Pattern.find(filter)
      .sort({ category: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v')
      .lean(),
    Pattern.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) });
}

async function saveTile(file) {
  const tile = await processPatternTile(file.buffer);
  const imageUrl = await storage.putPublic(
    `patterns/custom/${crypto.randomUUID()}.png`,
    tile.buffer,
  );
  return { imageUrl, tileSize: { width: tile.width, height: tile.height } };
}

async function create(req, res) {
  if (!req.file) throw ApiError.badRequest('Upload the pattern tile image in the "image" field.');
  const pattern = await Pattern.create({ ...req.body, ...(await saveTile(req.file)) });
  res.status(201).json({ pattern });
}

async function update(req, res) {
  const pattern = await Pattern.findById(req.params.id);
  if (!pattern) throw ApiError.notFound('Pattern not found');
  const previousUrl = pattern.imageUrl;
  Object.assign(pattern, req.body);
  if (req.file) Object.assign(pattern, await saveTile(req.file));
  await pattern.save();
  if (req.file) await storage.removePublic(previousUrl).catch(() => undefined);
  res.json({ pattern });
}

async function remove(req, res) {
  const pattern = await Pattern.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { returnDocument: 'after' },
  );
  if (!pattern) throw ApiError.notFound('Pattern not found');
  res.json({ pattern });
}

module.exports = { list, getById, adminList, create, update, remove };
