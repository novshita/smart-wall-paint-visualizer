const { Router } = require('express');
const ctrl = require('../controllers/pattern.controller');
const validate = require('../middleware/validate');
const { listPatterns } = require('../validators/catalog.validators');
const { idParam } = require('../validators/common.validators');

const router = Router();

router.get('/', validate(listPatterns, 'query'), ctrl.list);
router.get('/:id', validate(idParam, 'params'), ctrl.getById);

module.exports = router;
