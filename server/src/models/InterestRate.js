const mongoose = require('mongoose');
const jsonId = require('./_json');

const rateSchema = new mongoose.Schema(
  {
    product: { type: String, enum: ['savings', 'loan'], required: true, index: true },
    ratePct: { type: Number, required: true, min: 0, max: 100 }, // percent per year
    effectiveFrom: { type: Date, required: true, default: Date.now },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);
jsonId(rateSchema);

const InterestRate = mongoose.model('InterestRate', rateSchema);

/** The rate that applies now: the newest one whose effective date has arrived. Returns null if none. */
InterestRate.current = (product, at = new Date()) =>
  InterestRate.findOne({ product, effectiveFrom: { $lte: at } }).sort({ effectiveFrom: -1, createdAt: -1 });

module.exports = InterestRate;
