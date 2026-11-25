const asyncHandler = require('../utils/asyncHandler');
const { runDailyJobs } = require('../services/jobs.service');
const { audit } = require('../services/audit.service');

/** Lets an administrator run the daily jobs now (overdue marking, reminders, monthly interest, checkpoint). */
exports.run = asyncHandler(async (req, res) => {
  const result = await runDailyJobs();
  await audit(req, { action: 'jobs.run', actor: req.user, meta: result });
  res.json({ result });
});
