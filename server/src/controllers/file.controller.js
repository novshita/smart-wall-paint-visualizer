const ApiError = require('../utils/api-error');
const { storage } = require('../services/storage.service');

const MIME = { jpg: 'image/jpeg', png: 'image/png' };

/** Streams a private file after checking its signed URL. */
function serve(req, res, next) {
  const key = [].concat(req.params.key).join('/');
  const { exp, sig } = req.query;
  if (!storage.verify(key, exp, sig)) {
    return next(ApiError.forbidden('This image link is invalid or has expired.'));
  }

  const ext = key.split('.').pop();
  res.sendFile(
    storage.pathFor(key),
    {
      headers: {
        'Content-Type': MIME[ext],
        'Cache-Control': 'private, max-age=3600',
        // Images are drawn onto <canvas> in the studio, so allow cross-origin use
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
      },
      dotfiles: 'deny',
    },
    (err) => {
      if (err && !res.headersSent)
        next(err.code === 'ENOENT' ? ApiError.notFound('Image not found') : err);
    },
  );
}

module.exports = { serve };
