const { Project } = require('../models');
const ApiError = require('../utils/api-error');
const projectService = require('../services/project.service');
const { logActivity } = require('../services/activity.service');

async function create(req, res) {
  if (!req.file) throw ApiError.badRequest('Choose a photo to upload.');

  const project = await projectService.createFromUpload(req.user._id, req.file, req.body.title);
  await logActivity(req.user._id, 'upload', {
    projectId: project._id,
    metadata: {
      sizeBytes: project.originalImage.sizeBytes,
      width: project.originalImage.width,
      height: project.originalImage.height,
    },
  });

  res.status(201).json({ project: projectService.toResponse(project) });
}

async function list(req, res) {
  const { page, limit, status } = req.query;
  const filter = { userId: req.user._id };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Project.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-variants.regions')
      .lean(),
    Project.countDocuments(filter),
  ]);

  res.json({
    items: items.map(projectService.toResponse),
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

async function getById(req, res) {
  const project = await projectService.findAccessible(req.params.id, req.user);
  res.json({ project: projectService.toResponse(project) });
}

async function remove(req, res) {
  const project = await projectService.findAccessible(req.params.id, req.user);
  await projectService.deleteProject(project);
  await logActivity(req.user._id, 'delete', {
    projectId: project._id,
    metadata: { byAdmin: !project.userId.equals(req.user._id) },
  });
  res.status(204).end();
}

module.exports = { create, list, getById, remove };
