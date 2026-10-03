const { Router } = require('express');
const ctrl = require('../controllers/file.controller');

const router = Router();

// Access is controlled by the URL signature, not a login token, so <img> tags work
router.get('/*key', ctrl.serve);

module.exports = router;
