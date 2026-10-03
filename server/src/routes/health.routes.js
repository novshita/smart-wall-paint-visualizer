const { Router } = require('express');
const mongoose = require('mongoose');

const router = Router();

/**
 * Liveness/readiness probe used by local dev, CI, and the hosting platform.
 */
router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ok', db: dbState, uptime: Math.round(process.uptime()) });
});

module.exports = router;
