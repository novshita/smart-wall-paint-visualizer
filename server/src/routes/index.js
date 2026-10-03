const { Router } = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');

// Feature routers (auth, projects, colors, ...) are mounted here as they are built.
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

module.exports = router;
