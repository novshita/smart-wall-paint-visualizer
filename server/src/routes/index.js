const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const colorRoutes = require('./color.routes');
const patternRoutes = require('./pattern.routes');
const meRoutes = require('./me.routes');
const projectRoutes = require('./project.routes');
const fileRoutes = require('./file.routes');
const settingsRoutes = require('./settings.routes');
const activityRoutes = require('./activity.routes');
const adminRoutes = require('./admin.routes');
const feedbackRoutes = require('./feedback.routes');

// Feature routers (auth, projects, colors, ...) are mounted here as they are built.
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/colors', colorRoutes);
router.use('/patterns', patternRoutes);
router.use('/me', meRoutes);
router.use('/projects', projectRoutes);
router.use('/files', fileRoutes);
router.use('/settings', settingsRoutes);
router.use('/activity', activityRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
