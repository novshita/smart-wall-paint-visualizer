const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const colorRoutes = require('./color.routes');
const patternRoutes = require('./pattern.routes');
const meRoutes = require('./me.routes');
const projectRoutes = require('./project.routes');
const fileRoutes = require('./file.routes');
const settingsRoutes = require('./settings.routes');

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

module.exports = router;
