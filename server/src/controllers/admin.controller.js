const mongoose = require('mongoose');
const { User, Project, ActivityLog, Setting } = require('../models');
const ApiError = require('../utils/api-error');
const { escapeRegex } = require('../utils/regex');
const projectService = require('../services/project.service');
const { getSettings } = require('../services/settings.service');
const { getAnalytics } = require('../services/analytics.service');

const paged = (items, total, page, limit) => ({
  items,
  total,
  page,
  limit,
  pages: Math.max(1, Math.ceil(total / limit)),
});

// ---------- users (FR-AD4) ----------

async function listUsers(req, res) {
  const { q, role, status, page, limit } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.isActive = status === 'active';
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Project.aggregate([
    { $match: { userId: { $in: users.map((u) => u._id) } } },
    { $group: { _id: '$userId', count: { $sum: 1 } } },
  ]);
  const byUser = new Map(counts.map((c) => [c._id.toString(), c.count]));
  const items = users.map(({ passwordHash: _p, tokenVersion: _t, __v: _v, ...u }) => ({
    ...u,
    projectCount: byUser.get(u._id.toString()) ?? 0,
  }));
  res.json(paged(items, total, page, limit));
}

/** Change role or activate/deactivate. Admins can't lock themselves out. */
async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  const self = user._id.equals(req.user._id);
  if (self && (req.body.isActive === false || req.body.role === 'user')) {
    throw ApiError.badRequest("You can't deactivate or demote your own account.");
  }
  if (req.body.role !== undefined) user.role = req.body.role;
  if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
  await user.save();
  res.json({ user: user.toJSON() });
}

// ---------- designs, read-only (FR-AD5) ----------

async function listProjects(req, res) {
  const { q, userId, status, page, limit } = req.query;
  const filter = {};
  if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
  if (status) filter.status = status;
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  const [items, total] = await Promise.all([
    Project.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .lean(),
    Project.countDocuments(filter),
  ]);
  const shaped = items.map((p) => {
    const owner = p.userId;
    return { ...projectService.toResponse({ ...p, userId: owner?._id }), owner };
  });
  res.json(paged(shaped, total, page, limit));
}

// ---------- activity (FR-AD5) ----------

async function listActivity(req, res) {
  const { action, userId, from, to, page, limit } = req.query;
  const filter = {};
  if (action) filter.action = action;
  if (userId) filter.userId = new mongoose.Types.ObjectId(userId);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  const [items, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name email')
      .populate('projectId', 'title')
      .lean(),
    ActivityLog.countDocuments(filter),
  ]);
  res.json(paged(items, total, page, limit));
}

// ---------- settings (FR-AD6) ----------

async function readSettings(req, res) {
  res.json({ settings: await getSettings() });
}

async function writeSettings(req, res) {
  await Promise.all(
    Object.entries(req.body).map(([key, value]) =>
      Setting.updateOne({ key }, { $set: { value, updatedBy: req.user._id } }, { upsert: true }),
    ),
  );
  res.json({ settings: await getSettings() });
}

// ---------- analytics (FR-AD7) ----------

async function analytics(req, res) {
  res.json(await getAnalytics(req.query));
}

module.exports = {
  listUsers,
  updateUser,
  listProjects,
  listActivity,
  readSettings,
  writeSettings,
  analytics,
};
