const mongoose = require('mongoose');
const jsonId = require('./_json');

const TYPES = ['deposit', 'withdrawal', 'interest', 'loan_disbursement', 'loan_repayment', 'reversal'];

// Append-only: the application only creates entries, never edits or deletes them.
// Every entry stores prevHash (the hash of the entry before it) and its own hash, forming a chain.
const entrySchema = new mongoose.Schema({
  seq: { type: Number, required: true, unique: true },                 // 1, 2, 3, ... with no gaps
  type: { type: String, enum: TYPES, required: true },
  amountPaisa: { type: Number, required: true, min: 1 },
  deltaPaisa: { type: Number, required: true },                        // signed effect on the account balance (0 for cash loan repayments)
  account: { type: mongoose.Schema.Types.ObjectId, ref: 'SavingsAccount', default: null, index: true },
  loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', default: null },
  balanceAfterPaisa: { type: Number, default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = the system (scheduled jobs)
  memo: { type: String, default: '', maxlength: 200 },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
  period: { type: String, default: '' },                               // YYYY-MM, used by monthly interest so it is never posted twice
  createdAt: { type: Date, required: true },
  prevHash: { type: String, required: true },
  hash: { type: String, required: true },
});
entrySchema.index({ type: 1, createdAt: 1 });
jsonId(entrySchema);

module.exports = mongoose.model('LedgerEntry', entrySchema);
module.exports.TYPES = TYPES;
