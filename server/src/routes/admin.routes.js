const { Router } = require('express');
const ctrl = require('../controllers/admin.controller');
const colorCtrl = require('../controllers/color.controller');
const patternCtrl = require('../controllers/pattern.controller');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { idParam } = require('../validators/common.validators');
const schemas = require('../validators/admin.validators');

// Everything under /admin requires an admin (FR-A4). Colour/pattern writes live on
// /colors and /patterns (spec §10.3); these are the admin-only list views.
const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/users', validate(schemas.listUsers, 'query'), ctrl.listUsers);
router.patch(
  '/users/:id',
  validate(idParam, 'params'),
  validate(schemas.updateUser),
  ctrl.updateUser,
);
router.get('/projects', validate(schemas.listAllProjects, 'query'), ctrl.listProjects);
router.get('/activity', validate(schemas.listActivity, 'query'), ctrl.listActivity);
router.get('/settings', ctrl.readSettings);
router.put('/settings', validate(schemas.updateSettings), ctrl.writeSettings);
router.get('/analytics', validate(schemas.analyticsQuery, 'query'), ctrl.analytics);
router.get('/colors', validate(schemas.listAdminColors, 'query'), colorCtrl.adminList);
router.get('/patterns', validate(schemas.listAdminPatterns, 'query'), patternCtrl.adminList);

module.exports = router;
