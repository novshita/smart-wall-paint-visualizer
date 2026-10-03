const { Router } = require('express');
const ctrl = require('../controllers/project.controller');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rate-limit');
const { idParam } = require('../validators/common.validators');
const schemas = require('../validators/project.validators');

const router = Router();

router.use(authenticate);

router.post('/', uploadLimiter, uploadImage('image'), validate(schemas.createProject), ctrl.create);
router.get('/', validate(schemas.listProjects, 'query'), ctrl.list);
router.get('/:id', validate(idParam, 'params'), ctrl.getById);
router.delete('/:id', validate(idParam, 'params'), ctrl.remove);

module.exports = router;
