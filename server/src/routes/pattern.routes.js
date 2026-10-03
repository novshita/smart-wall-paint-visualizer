const { Router } = require('express');
const ctrl = require('../controllers/pattern.controller');
const validate = require('../middleware/validate');
const { listPatterns } = require('../validators/catalog.validators');
const { idParam } = require('../validators/common.validators');
const admin = require('../validators/admin.validators');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');

const router = Router();
const adminOnly = [authenticate, requireRole('admin')];

router.get('/', validate(listPatterns, 'query'), ctrl.list);
router.get('/:id', validate(idParam, 'params'), ctrl.getById);
router.post('/', adminOnly, uploadImage('image'), validate(admin.createPattern), ctrl.create);
router.put(
  '/:id',
  adminOnly,
  validate(idParam, 'params'),
  uploadImage('image'),
  validate(admin.updatePattern),
  ctrl.update,
);
router.delete('/:id', adminOnly, validate(idParam, 'params'), ctrl.remove);

module.exports = router;
