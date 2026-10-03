const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: {
      type: String,
      required: true,
      enum: [
        'register',
        'login',
        'logout',
        'upload',
        'save',
        'download',
        'delete',
        'session_start',
        'session_end',
      ],
    },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    sessionId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'activity_logs' },
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
