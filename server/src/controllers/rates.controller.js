const asyncHandler = require('../utils/asyncHandler');
const InterestRate = require('../models/InterestRate');
const { audit } = require('../services/audit.service');

exports.list = asyncHandler(async (req, res) => {
  const [savings, loan, history] = await Promise.all([
    InterestRate.current('savings'), InterestRate.current('loan'),
    InterestRate.find().sort({ effectiveFrom: -1, createdAt: -1 }).limit(50),
  ]);
  res.json({ current: { savings, loan }, history });
});

exports.create = asyncHandler(async (req, res) => {
  const rate = await InterestRate.create({
    product: req.body.product, ratePct: req.body.ratePct,
    effectiveFrom: req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date(), setBy: req.user._id,
  });
  await audit(req, { action: 'rate.set', actor: req.user, entityType: 'InterestRate', entityId: rate._id, meta: { product: rate.product, ratePct: rate.ratePct } });
  res.status(201).json({ rate });
});
