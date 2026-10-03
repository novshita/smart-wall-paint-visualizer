const env = require('../config/env');
const { Setting } = require('../models');

// Fallbacks used when a setting has not been seeded or saved by an admin yet.
const DEFAULTS = {
  maxUploadMb: env.maxUploadMb,
  allowedFormats: ['image/jpeg', 'image/png'],
  defaultFinish: 'matte',
  disclaimerText:
    'Previews are a visual guide only. Actual colours may vary due to lighting, screen calibration, and wall texture.',
};

// Settings that the browser is allowed to see
const PUBLIC_KEYS = ['maxUploadMb', 'allowedFormats', 'defaultFinish', 'disclaimerText'];

/** Reads settings fresh on every call so admin changes apply immediately (FR-AD6). */
async function getSettings(keys = Object.keys(DEFAULTS)) {
  const rows = await Setting.find({ key: { $in: keys } }).lean();
  const values = Object.fromEntries(keys.map((k) => [k, DEFAULTS[k]]));
  for (const { key, value } of rows) {
    if (value !== undefined && value !== null) values[key] = value;
  }
  return values;
}

async function getSetting(key) {
  return (await getSettings([key]))[key];
}

function getPublicSettings() {
  return getSettings(PUBLIC_KEYS);
}

module.exports = { getSettings, getSetting, getPublicSettings, DEFAULTS };
