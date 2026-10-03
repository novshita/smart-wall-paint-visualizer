/**
 * Removes data created by the end-to-end tests: accounts with emails ending in
 * @e2e.test (with their projects, image files, activity and feedback) and test
 * colours whose code starts with E2E-.
 * Usage: npm run e2e:clean
 */
const env = require('../config/env');
const { connectDb, disconnectDb } = require('../config/db');
const { User, Project, ActivityLog, Feedback, Color } = require('../models');
const { deleteProject } = require('../services/project.service');

async function main() {
  await connectDb(env.mongoUri);
  const users = await User.find({ email: /@e2e\.test$/ })
    .select('_id')
    .lean();
  const ids = users.map((u) => u._id);

  const projects = await Project.find({ userId: { $in: ids } });
  for (const p of projects) await deleteProject(p);

  const [logs, feedback, removed, colors] = await Promise.all([
    ActivityLog.deleteMany({ userId: { $in: ids } }),
    Feedback.deleteMany({ userId: { $in: ids } }),
    User.deleteMany({ _id: { $in: ids } }),
    Color.deleteMany({ code: /^E2E-/ }),
  ]);
  console.log(
    `Removed ${removed.deletedCount} test users, ${projects.length} projects, ` +
      `${logs.deletedCount} activity entries, ${feedback.deletedCount} ratings, ` +
      `${colors.deletedCount} test colours`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
