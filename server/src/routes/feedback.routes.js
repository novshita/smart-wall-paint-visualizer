const { Router } = require('express');
const Joi = require('joi');
const { Feedback, Project } = require('../models');
const ApiError = require('../utils/api-error');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { objectId } = require('../validators/common.validators');

const router = Router();

const feedbackSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).allow(''),
  projectId: objectId,
});

/** POST /feedback: satisfaction rating for the KPI dashboard (spec §10.6, §14). */
router.post('/', authenticate, validate(feedbackSchema), async (req, res) => {
  const { rating, comment, projectId } = req.body;
  if (projectId && !(await Project.exists({ _id: projectId, userId: req.user._id }))) {
    throw ApiError.notFound('Project not found');
  }
  const feedback = await Feedback.create({ userId: req.user._id, rating, comment, projectId });
  res.status(201).json({ feedback });
});

module.exports = router;
