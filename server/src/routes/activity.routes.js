const { Router } = require('express');
const ctrl = require('../controllers/activity.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { logEvent } = require('../validators/activity.validators');

const router = Router();

router.post('/', authenticate, validate(logEvent), ctrl.log);

module.exports = router;
