const env = require('../config/env');

// Default system settings (editable later from the admin panel, FR-AD6)
module.exports = [
  { key: 'maxUploadMb', value: env.maxUploadMb },
  { key: 'allowedFormats', value: ['image/jpeg', 'image/png'] },
  { key: 'defaultFinish', value: 'matte' },
  {
    key: 'disclaimerText',
    value:
      'Previews are a visual guide only. Actual colours may vary due to lighting, screen calibration, and wall texture.',
  },
];
