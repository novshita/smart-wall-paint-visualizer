const { ActivityLog } = require('../models');

/**
 * Records a user action for the admin activity view and KPIs (spec §9.5, §14).
 * Never throws: analytics must not break the user's request.
 */
async function logActivity(userId, action, { projectId, metadata, sessionId } = {}) {
  try {
    await ActivityLog.create({ userId, action, projectId, metadata, sessionId });
  } catch (err) {
    console.error(`Failed to log activity "${action}":`, err.message);
  }
}

module.exports = { logActivity };
