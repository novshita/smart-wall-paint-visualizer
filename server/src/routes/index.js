const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const colorRoutes = require('./color.routes');
const patternRoutes = require('./pattern.routes');
const meRoutes = require('./me.routes');

// Feature routers (auth, projects, colors, ...) are mounted here as they are built.
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/colors', colorRoutes);
router.use('/patterns', patternRoutes);
router.use('/me', meRoutes);

module.exports = router;
