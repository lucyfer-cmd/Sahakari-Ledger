const mongoose = require('mongoose');
const jsonId = require('./_json');

const accountSchema = new mongoose.Schema(
  {
    accountNo: { type: String, required: true, unique: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    balancePaisa: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    openedAt: { type: Date, default: Date.now },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);
jsonId(accountSchema);

module.exports = mongoose.model('SavingsAccount', accountSchema);
