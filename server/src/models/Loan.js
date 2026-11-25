const mongoose = require('mongoose');
const jsonId = require('./_json');

const loanSchema = new mongoose.Schema(
  {
    loanNo: { type: String, required: true, unique: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsAccount', required: true },
    principalPaisa: { type: Number, required: true, min: 1 },
    termMonths: { type: Number, required: true },
    purpose: { type: String, trim: true, maxlength: 200, default: '' },
    status: { type: String, enum: ['applied', 'approved', 'rejected', 'disbursed', 'closed'], default: 'applied', index: true },
    annualRatePct: { type: Number, default: null },        // fixed when the loan is approved
    emiPaisa: { type: Number, default: null },
    riskScore: { type: Number, required: true },
    riskBand: { type: String, enum: ['low', 'medium', 'high'], required: true },
    riskBreakdown: { type: mongoose.Schema.Types.Mixed, default: [] },
    appliedAt: { type: Date, default: Date.now },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', maxlength: 300 },
    disbursedAt: { type: Date, default: null },
    disbursedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
jsonId(loanSchema);

module.exports = mongoose.model('Loan', loanSchema);
