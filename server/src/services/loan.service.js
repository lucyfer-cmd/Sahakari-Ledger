const Loan = require('../models/Loan');
const Installment = require('../models/Installment');
const Member = require('../models/Member');
const { startOfDayUTC } = require('../utils/finance');

/** All overdue instalments with the member and the number of days late. */
async function overdueList(now = new Date()) {
  const today = startOfDayUTC(now);
  const items = await Installment.find({ status: 'overdue' }).sort({ dueDate: 1 }).lean();
  const out = [];
  for (const inst of items) {
    const loan = await Loan.findById(inst.loan).lean();
    if (!loan || loan.status !== 'disbursed') continue;
    const member = await Member.findById(loan.member).lean();
    out.push({
      loanId: loan._id, loanNo: loan.loanNo, memberId: loan.member, memberName: member ? member.fullName : '', membershipNo: member ? member.membershipNo : '',
      phone: member ? member.phone : '', installmentNo: inst.no, dueDate: inst.dueDate,
      daysOverdue: Math.max(1, Math.round((today - inst.dueDate) / 86400000)),
      unpaidPaisa: inst.principalDuePaisa + inst.interestDuePaisa - inst.paidPaisa,
    });
  }
  return out;
}

/** What is still to be paid on a loan, summed over its instalments. */
const remainingPaisa = (installments) => installments.reduce((s, i) => s + (i.principalDuePaisa + i.interestDuePaisa - i.paidPaisa), 0);

module.exports = { overdueList, remainingPaisa };
