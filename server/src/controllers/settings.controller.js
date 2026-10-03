const { getPublicSettings } = require('../services/settings.service');

async function getPublic(req, res) {
  res.json({ settings: await getPublicSettings() });
}

module.exports = { getPublic };
