const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { connectDb, disconnectDb } = require('../config/db');
const { User, Color, Pattern, Setting } = require('../models');
const colors = require('./colors');
const patterns = require('./patterns');
const settings = require('./settings');

/**
 * Idempotent seed: upserts by natural key, so it is safe to run repeatedly
 * and never overwrites an existing admin password.
 */
async function seed() {
  await connectDb(env.mongoUri);
  await Promise.all([User.init(), Color.init(), Pattern.init(), Setting.init()]);

  for (const c of colors) {
    await Color.updateOne(
      { code: c.code },
      { $setOnInsert: c },
      { upsert: true, runValidators: true },
    );
  }
  console.log(`Colours: ${await Color.countDocuments()}`);

  for (const p of patterns) {
    await Pattern.updateOne({ name: p.name }, { $setOnInsert: p }, { upsert: true });
  }
  console.log(`Patterns: ${await Pattern.countDocuments()}`);

  for (const s of settings) {
    await Setting.updateOne({ key: s.key }, { $setOnInsert: s }, { upsert: true });
  }
  console.log(`Settings: ${await Setting.countDocuments()}`);

  if (env.admin.email && env.admin.password) {
    const email = env.admin.email.toLowerCase();
    const exists = await User.exists({ email });
    if (!exists) {
      const passwordHash = await bcrypt.hash(env.admin.password, 12);
      await User.create({ name: 'Administrator', email, passwordHash, role: 'admin' });
      console.log(`Admin created: ${email}`);
    } else {
      console.log(`Admin already exists: ${email}`);
    }
  } else {
    console.warn('ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin account');
  }
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
