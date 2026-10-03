const env = require('./config/env');
const { connectDb, disconnectDb } = require('./config/db');
const createApp = require('./app');

async function start() {
  await connectDb(env.mongoUri);
  console.log('MongoDB connected');

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}/api/v1`);
    console.log(`API docs at http://localhost:${env.port}/api/docs`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
