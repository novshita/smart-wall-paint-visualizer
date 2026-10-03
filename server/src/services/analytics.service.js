const { ActivityLog, Project, Feedback, User, Color } = require('../models');

const DAY = 24 * 60 * 60 * 1000;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/** Resolves the reporting window: explicit from/to, or the last N days (inclusive of today). */
function resolveRange({ from, to, days = 30 }) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - (days - 1) * DAY);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);
  return { from: start, to: end };
}

/**
 * KPI dashboard data (spec §14, FR-AD7): uploads, designs saved, average session
 * duration and user satisfaction, plus daily trends and the most-used colours.
 */
async function getAnalytics(query) {
  const { from, to } = resolveRange(query);
  const inRange = { createdAt: { $gte: from, $lte: to } };

  const [
    uploads,
    savedProjectIds,
    totalSavedDesigns,
    sessionStats,
    feedbackStats,
    ratingRows,
    daily,
    totalUsers,
    activeUserIds,
    topColorRows,
  ] = await Promise.all([
    ActivityLog.countDocuments({ action: 'upload', ...inRange }),
    ActivityLog.distinct('projectId', { action: 'save', ...inRange }),
    Project.countDocuments({ status: 'saved' }),
    ActivityLog.aggregate([
      { $match: { action: 'session_end', ...inRange, 'metadata.durationSeconds': { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$metadata.durationSeconds' }, count: { $sum: 1 } } },
    ]),
    Feedback.aggregate([
      { $match: inRange },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    Feedback.aggregate([{ $match: inRange }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
    ActivityLog.aggregate([
      { $match: { action: { $in: ['upload', 'save', 'download', 'register'] }, ...inRange } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
            action: '$action',
          },
          count: { $sum: 1 },
        },
      },
    ]),
    User.countDocuments(),
    ActivityLog.distinct('userId', {
      action: { $in: ['login', 'register', 'session_start'] },
      ...inRange,
    }),
    Project.aggregate([
      { $match: { updatedAt: { $gte: from, $lte: to } } },
      { $unwind: '$variants' },
      { $unwind: '$variants.regions' },
      {
        $project: {
          ids: ['$variants.regions.style.colorId', '$variants.regions.style.secondaryColorId'],
        },
      },
      { $unwind: '$ids' },
      { $match: { ids: { $ne: null } } },
      { $group: { _id: '$ids', uses: { $sum: 1 } } },
      { $sort: { uses: -1 } },
      { $limit: 8 },
    ]),
  ]);

  // Fill every day in the window so charts have no gaps
  const series = [];
  const counts = new Map(daily.map((d) => [`${d._id.day}|${d._id.action}`, d.count]));
  for (let t = from.getTime(); t <= to.getTime(); t += DAY) {
    const day = dayKey(new Date(t));
    series.push({
      date: day,
      uploads: counts.get(`${day}|upload`) ?? 0,
      saves: counts.get(`${day}|save`) ?? 0,
      downloads: counts.get(`${day}|download`) ?? 0,
      signups: counts.get(`${day}|register`) ?? 0,
    });
  }

  const colors = await Color.find({ _id: { $in: topColorRows.map((r) => r._id) } })
    .select('name code hex brand')
    .lean();
  const colorById = new Map(colors.map((c) => [c._id.toString(), c]));
  const topColors = topColorRows
    .map((r) => ({ color: colorById.get(r._id.toString()), uses: r.uses }))
    .filter((r) => r.color);

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratingRows.find((r) => r._id === rating)?.count ?? 0,
  }));

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    kpis: {
      uploads,
      designsSaved: savedProjectIds.filter(Boolean).length,
      totalSavedDesigns,
      avgSessionSeconds: Math.round(sessionStats[0]?.avg ?? 0),
      sessions: sessionStats[0]?.count ?? 0,
      satisfaction: {
        average: feedbackStats[0] ? Math.round(feedbackStats[0].avg * 10) / 10 : null,
        responses: feedbackStats[0]?.count ?? 0,
        distribution,
      },
      totalUsers,
      activeUsers: activeUserIds.filter(Boolean).length,
    },
    series,
    topColors,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getAnalytics, resolveRange };
