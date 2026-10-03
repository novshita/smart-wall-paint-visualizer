const { Router } = require('express');
const ctrl = require('../controllers/color.controller');
const validate = require('../middleware/validate');
const { listColors } = require('../validators/catalog.validators');
const { idParam } = require('../validators/common.validators');
const admin = require('../validators/admin.validators');
const { authenticate, requireRole } = require('../middleware/auth');
const multer = require('multer');

const router = Router();
const adminOnly = [authenticate, requireRole('admin')];
// CSV/JSON import files: small text uploads, kept in memory
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
}).single('file');

router.get('/', validate(listColors, 'query'), ctrl.list);
router.get('/facets', ctrl.facets);
router.post('/import', adminOnly, importUpload, ctrl.importFile);
router.get('/:id', validate(idParam, 'params'), ctrl.getById);
router.post('/', adminOnly, validate(admin.createColor), ctrl.create);
router.put(
  '/:id',
  adminOnly,
  validate(idParam, 'params'),
  validate(admin.updateColor),
  ctrl.update,
);
router.delete('/:id', adminOnly, validate(idParam, 'params'), ctrl.remove);

module.exports = router;
