const Joi = require('joi');

const name = Joi.string().trim().min(2).max(100);
const email = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .max(254);
// At least 8 chars with one letter and one number; capped to stay under bcrypt's 72-byte limit
const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/\d/, 'number')
  .messages({
    'string.pattern.name': 'Password must contain at least one {#name}',
  });

const register = Joi.object({
  name: name.required(),
  email: email.required(),
  password: password.required(),
});

const login = Joi.object({
  email: email.required(),
  password: Joi.string().max(72).required(),
});

const updateProfile = Joi.object({
  name,
  email,
}).min(1);

const changePassword = Joi.object({
  currentPassword: Joi.string().max(72).required(),
  newPassword: password.required().invalid(Joi.ref('currentPassword')).messages({
    'any.invalid': 'New password must be different from the current password',
  }),
});

module.exports = { register, login, updateProfile, changePassword };
