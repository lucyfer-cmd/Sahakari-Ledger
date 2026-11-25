const mongoose = require('mongoose');
const jsonId = require('./_json');

const installmentSchema = new mongoose.Schema(
  {
    loan: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
    no: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    principalDuePaisa: { type: Number, required: true },
    interestDuePaisa: { type: Number, required: true },
    paidPaisa: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'partial', 'paid', 'overdue'], default: 'pending' },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);
installmentSchema.index({ loan: 1, no: 1 }, { unique: true });
installmentSchema.index({ status: 1, dueDate: 1 });
installmentSchema.virtual('amountDuePaisa').get(function amountDue() { return this.principalDuePaisa + this.interestDuePaisa; });
jsonId(installmentSchema);
installmentSchema.set('toJSON', {
  virtuals: true, versionKey: false,
  transform: (doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; },
});

module.exports = mongoose.model('Installment', installmentSchema);
