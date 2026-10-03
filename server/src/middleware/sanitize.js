/**
 * Strips keys starting with `$` or containing `.` from request input to
 * prevent NoSQL operator injection (e.g. `{ "email": { "$gt": "" } }`).
 * Mutates objects in place because Express 5 exposes `req.query` as a getter.
 */
function clean(value) {
  if (Array.isArray(value)) {
    value.forEach(clean);
  } else if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
      } else {
        clean(value[key]);
      }
    }
  }
  return value;
}

function sanitize(req, res, next) {
  clean(req.body);
  clean(req.params);
  clean(req.query);
  next();
}

module.exports = { sanitize, clean };
