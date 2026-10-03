const { Router } = require('express');
const ctrl = require('../controllers/settings.controller');

const router = Router();

router.get('/public', ctrl.getPublic);

module.exports = router;
