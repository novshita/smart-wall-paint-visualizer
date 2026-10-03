const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const schemas = require('../validators/auth.validators');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rate-limit');

const router = Router();

router.post('/register', authLimiter, validate(schemas.register), ctrl.register);
router.post('/login', authLimiter, validate(schemas.login), ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, validate(schemas.updateProfile), ctrl.updateMe);
router.patch(
  '/password',
  authLimiter,
  authenticate,
  validate(schemas.changePassword),
  ctrl.changePassword,
);

module.exports = router;
