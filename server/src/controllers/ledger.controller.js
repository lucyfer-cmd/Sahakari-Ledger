const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const LedgerEntry = require('../models/LedgerEntry');
const IntegrityCheckpoint = require('../models/IntegrityCheckpoint');
const ledger = require('../services/ledger.service');
const { audit } = require('../services/audit.service');
const { paging } = require('../middleware/validators');

exports.list = asyncHandler(async (req, res) => {
  const { limit, page, skip } = paging(req, 25);
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.account) filter.account = req.query.account;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(new Date(req.query.to).getTime() + 86400000 - 1);
  }
  const [entries, total] = await Promise.all([
    LedgerEntry.find(filter).sort({ seq: -1 }).skip(skip).limit(limit).populate('account', 'accountNo'),
    LedgerEntry.countDocuments(filter),
  ]);
  res.json({ entries, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

/** The integrity check: re-computes the whole hash chain and reports the first problem. */
exports.verify = asyncHandler(async (req, res) => {
  const result = await ledger.verifyChain();
  await audit(req, {
    action: 'ledger.verify', actor: req.user, outcome: result.ok ? 'success' : 'failure',
    meta: { ok: result.ok, entriesChecked: result.entriesChecked, firstBadSeq: result.firstBadSeq, reasons: result.problems.map((p) => p.reason) },
  });
  res.json(result);
});

exports.listCheckpoints = asyncHandler(async (req, res) => {
  res.json({ checkpoints: await IntegrityCheckpoint.find().sort({ upToSeq: -1 }).limit(50) });
});

exports.createCheckpoint = asyncHandler(async (req, res) => {
  const { checkpoint, created } = await ledger.createCheckpoint(req.user._id);
  if (created) await audit(req, { action: 'ledger.checkpoint', actor: req.user, entityType: 'IntegrityCheckpoint', entityId: checkpoint._id, meta: { upToSeq: checkpoint.upToSeq } });
  res.status(created ? 201 : 200).json({ checkpoint, created });
});

exports.reverse = asyncHandler(async (req, res) => {
  if (!req.body.reason) throw new AppError(400, 'VALIDATION_ERROR', 'A reason is required');
  const entry = await ledger.reverse(req.params.id, req.body.reason, req.user._id);
  await audit(req, { action: 'ledger.reverse', actor: req.user, entityType: 'LedgerEntry', entityId: entry._id, meta: { reversalOf: String(entry.reversalOf), reason: req.body.reason } });
  res.status(201).json({ entry });
});
