const asyncHandler = require('../utils/asyncHandler');
const AuditLog = require('../models/AuditLog');
const { paging, escapeRegex } = require('../middleware/validators');

exports.list = asyncHandler(async (req, res) => {
  const { limit, page, skip } = paging(req, 30);
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.outcome) filter.outcome = req.query.outcome;
  if (req.query.actor) filter.actorEmail = new RegExp(escapeRegex(req.query.actor), 'i');
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(new Date(req.query.to).getTime() + 86400000 - 1);
  }
  const [logs, total, actions] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
    AuditLog.distinct('action'),
  ]);
  res.json({ logs, total, page, pages: Math.max(1, Math.ceil(total / limit)), actions: actions.sort() });
});
