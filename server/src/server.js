const env = require('./config/env');
const { connectDb } = require('./config/db');
const createApp = require('./app');
const { startScheduler } = require('./services/jobs.service');

(async () => {
  await connectDb();
  createApp().listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}`));
  if (!env.isTest) startScheduler();
})().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
