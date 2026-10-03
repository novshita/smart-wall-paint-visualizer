const { Pattern } = require('../models');
const ApiError = require('../utils/api-error');
const { escapeRegex } = require('../utils/regex');

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

module.exports = { list, getById };
