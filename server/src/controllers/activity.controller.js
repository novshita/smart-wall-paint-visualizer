const { Project } = require('../models');
const ApiError = require('../utils/api-error');
const { logActivity } = require('../services/activity.service');

/** POST /activity: records client-side events (downloads, session start/end). */
async function log(req, res) {
  const { action, projectId, sessionId, metadata } = req.body;
  if (projectId && !(await Project.exists({ _id: projectId, userId: req.user._id }))) {
    throw ApiError.notFound('Project not found');
  }
  await logActivity(req.user._id, action, { projectId, sessionId, metadata });
  res.status(204).end();
}

module.exports = { log };
