const sharp = require('sharp');
const ApiError = require('../utils/api-error');

const MIN_SIDE = 200; // too small to select walls on
const MAX_PIXELS = 50_000_000; // ~50 MP; guards against decompression bombs
const WORKING_MAX = 2000; // spec FR-U5 working resolution
const THUMB_MAX = 480;

const FORMATS = {
  jpeg: { mime: 'image/jpeg', ext: 'jpg' },
  png: { mime: 'image/png', ext: 'png' },
};

/** Identifies JPEG/PNG from the file's magic bytes, ignoring name and declared type. */
function detectFormat(buffer) {
  if (!buffer || buffer.length < 8) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => buffer[i] === byte)) return 'png';
  return null;
}

function encode(pipeline, format, quality) {
  return format === 'png'
    ? pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
    : pipeline.jpeg({ quality, mozjpeg: true });
}

async function render(pipeline) {
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height, sizeBytes: info.size };
}

/**
 * Validates an uploaded photo and re-encodes it (spec §12): auto-rotates using EXIF,
 * then writes fresh pixels with no metadata, which drops GPS/location data and any
 * payload hidden in the original file. Produces original, working and thumbnail sizes.
 */
async function processUpload(buffer, { allowedMimes = ['image/jpeg', 'image/png'] } = {}) {
  const format = detectFormat(buffer);
  if (!format || !allowedMimes.includes(FORMATS[format].mime)) {
    throw ApiError.badRequest('Only JPG and PNG images are allowed.');
  }

  const input = () =>
    sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error', sequentialRead: true });

  let meta;
  try {
    meta = await input().metadata();
  } catch (err) {
    if (/pixel limit/i.test(err.message)) {
      throw ApiError.badRequest('This image has too many pixels. Please use a smaller photo.');
    }
    throw ApiError.badRequest('This file is not a valid image or is damaged.');
  }
  if (meta.format !== format) {
    throw ApiError.badRequest('This file is not a valid image or is damaged.');
  }

  const { ext, mime } = FORMATS[format];
  try {
    const original = await render(encode(input().rotate(), format, 92));
    if (Math.min(original.width, original.height) < MIN_SIDE) {
      throw ApiError.badRequest(
        `This image is too small. Use a photo at least ${MIN_SIDE} × ${MIN_SIDE} pixels.`,
      );
    }

    const fitInside = (max) => ({
      width: max,
      height: max,
      fit: 'inside',
      withoutEnlargement: true,
    });
    const working = await render(
      encode(input().rotate().resize(fitInside(WORKING_MAX)), format, 90),
    );
    const thumbnail = await render(
      input().rotate().resize(fitInside(THUMB_MAX)).flatten({ background: '#ffffff' }).jpeg({
        quality: 80,
        mozjpeg: true,
      }),
    );

    return { ext, mime, original, working, thumbnail };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.badRequest('This file is not a valid image or is damaged.');
  }
}

module.exports = { processUpload, detectFormat, MIN_SIDE, WORKING_MAX, THUMB_MAX };
