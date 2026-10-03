const multer = require('multer');
const ApiError = require('../utils/api-error');
const { getSetting, DEFAULTS } = require('../services/settings.service');

/**
 * Accepts a single image in the `image` field, kept in memory for validation and
 * re-encoding (nothing touches disk until it has been checked). The size limit is
 * read from admin settings on each request (FR-U1).
 */
function uploadImage(fieldName = 'image') {
  return async (req, res, next) => {
    const configured = Number(await getSetting('maxUploadMb'));
    const maxMb = configured > 0 ? configured : DEFAULTS.maxUploadMb;
    const parser = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: Math.floor(maxMb * 1024 * 1024), files: 1, fields: 10, parts: 12 },
    }).single(fieldName);

    parser(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ApiError(413, `This image is too large. The maximum size is ${maxMb} MB.`),
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
          return next(ApiError.badRequest(`Upload one image in the "${fieldName}" field.`));
        }
        return next(ApiError.badRequest('The upload could not be read. Please try again.'));
      }
      next(err);
    });
  };
}

module.exports = { uploadImage };
