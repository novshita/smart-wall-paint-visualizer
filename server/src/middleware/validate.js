const ApiError = require('../utils/api-error');

/**
 * Validates `req[source]` against a Joi schema and replaces it with the
 * sanitised value. Usage: `validate(schema)` or `validate(schema, 'query')`.
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
      return next(ApiError.badRequest('Validation failed', errors));
    }

    if (source === 'query') {
      // req.query is a read-only getter in Express 5
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
    } else {
      req[source] = value;
    }
    next();
  };
}

module.exports = validate;
