const { Router } = require('express');
const ctrl = require('../controllers/color.controller');
const validate = require('../middleware/validate');
const { listColors } = require('../validators/catalog.validators');
const { idParam } = require('../validators/common.validators');

// Admin create/update/delete/import routes are added with the admin panel.
const router = Router();

router.get('/', validate(listColors, 'query'), ctrl.list);
router.get('/facets', ctrl.facets);
router.get('/:id', validate(idParam, 'params'), ctrl.getById);

module.exports = router;
