const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Member = require('../models/Member');
const User = require('../models/User');
const SavingsAccount = require('../models/SavingsAccount');
const LedgerEntry = require('../models/LedgerEntry');
const Loan = require('../models/Loan');
const Installment = require('../models/Installment');
const AuditLog = require('../models/AuditLog');
const { overdueList, remainingPaisa } = require('../services/loan.service');
const { markOverdue } = require('../services/jobs.service');
const { monthlyPdf } = require('../services/pdf.service');
const { audit } = require('../services/audit.service');
const { toCsv } = require('../utils/csv');
const { monthKey } = require('../utils/finance');

const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
const monthRange = (month) => {
  const [y, m] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
};

async function summary() {
  await markOverdue();
  const [members, pendingLogins, accounts, loans, openInst, ledgerCount, lastEntry, lastVerify] = await Promise.all([
    Member.countDocuments({ status: 'active' }), User.countDocuments({ status: 'pending' }), SavingsAccount.find({ status: 'active' }).lean(),
    Loan.find().lean(), Installment.find({ status: { $in: ['pending', 'partial', 'overdue'] } }).lean(),
    LedgerEntry.countDocuments(), LedgerEntry.findOne().sort({ seq: -1 }).lean(), AuditLog.findOne({ action: 'ledger.verify' }).sort({ createdAt: -1 }).lean(),
  ]);
  const disbursedIds = new Set(loans.filter((l) => l.status === 'disbursed').map((l) => String(l._id)));
  const live = openInst.filter((i) => disbursedIds.has(String(i.loan)));
  const overdue = live.filter((i) => i.status === 'overdue');
  const byStatus = {};
  loans.forEach((l) => { byStatus[l.status] = (byStatus[l.status] || 0) + 1; });
  return {
    activeMembers: members, pendingMemberAccounts: pendingLogins, savingsAccounts: accounts.length,
    totalSavingsPaisa: sum(accounts, (a) => a.balancePaisa), loansByStatus: byStatus,
    loansAwaitingDecision: byStatus.applied || 0,
    loanReceivablePaisa: sum(live, (i) => i.principalDuePaisa + i.interestDuePaisa - i.paidPaisa),
    overdueInstallments: overdue.length, overduePaisa: sum(overdue, (i) => i.principalDuePaisa + i.interestDuePaisa - i.paidPaisa),
    ledgerEntries: ledgerCount, lastSeq: lastEntry ? lastEntry.seq : 0,
    lastIntegrityCheck: lastVerify ? { at: lastVerify.createdAt, ok: lastVerify.outcome === 'success', by: lastVerify.actorEmail } : null,
  };
}

async function monthly(month) {
  const { from, to } = monthRange(month);
  const entries = await LedgerEntry.find({ createdAt: { $gte: from, $lt: to } }).lean();
  const kinds = [['deposit', 'Deposits'], ['withdrawal', 'Withdrawals'], ['interest', 'Savings interest posted'],
    ['loan_disbursement', 'Loans disbursed'], ['loan_repayment', 'Loan repayments collected'], ['reversal', 'Reversals']];
  const rows = kinds.map(([type, label]) => {
    const list = entries.filter((e) => e.type === type);
    return { type, label, count: list.length, totalPaisa: sum(list, (e) => e.amountPaisa) };
  });
  return { month, rows, entries: entries.length };
}

exports.summary = asyncHandler(async (req, res) => res.json({ summary: await summary() }));

exports.monthly = asyncHandler(async (req, res) => {
  const month = req.query.month || monthKey(new Date());
  const report = await monthly(month);
  if (req.query.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-${month}.pdf"`);
    return monthlyPdf(res, report);
  }
  res.json({ report });
});

exports.defaulters = asyncHandler(async (req, res) => {
  await markOverdue();
  res.json({ defaulters: await overdueList() });
});

/** CSV downloads. Needs the report:export permission. */
exports.exportCsv = asyncHandler(async (req, res) => {
  const { kind } = req.params;
  let csv;
  if (kind === 'members') {
    const members = await Member.find().sort({ membershipNo: 1 }).lean();
    csv = toCsv([{ label: 'Membership no', value: 'membershipNo' }, { label: 'Name', value: 'fullName' }, { label: 'Phone', value: 'phone' },
      { label: 'Email', value: 'email' }, { label: 'Status', value: 'status' }, { label: 'Joined', value: (m) => m.joinedAt.toISOString().slice(0, 10) }], members);
  } else if (kind === 'ledger') {
    const entries = await LedgerEntry.find().sort({ seq: 1 }).populate('account', 'accountNo').lean();
    csv = toCsv([{ label: 'Seq', value: 'seq' }, { label: 'Date', value: (e) => e.createdAt.toISOString() }, { label: 'Type', value: 'type' },
      { label: 'Account', value: (e) => (e.account ? e.account.accountNo : '') }, { label: 'Amount (Rs)', value: (e) => (e.amountPaisa / 100).toFixed(2) },
      { label: 'Effect on balance (Rs)', value: (e) => (e.deltaPaisa / 100).toFixed(2) }, { label: 'Memo', value: 'memo' }, { label: 'Hash', value: 'hash' }], entries);
  } else if (kind === 'defaulters') {
    await markOverdue();
    const list = await overdueList();
    csv = toCsv([{ label: 'Loan', value: 'loanNo' }, { label: 'Membership no', value: 'membershipNo' }, { label: 'Member', value: 'memberName' }, { label: 'Phone', value: 'phone' },
      { label: 'Instalment', value: 'installmentNo' }, { label: 'Due date', value: (r) => r.dueDate.toISOString().slice(0, 10) }, { label: 'Days overdue', value: 'daysOverdue' },
      { label: 'Unpaid (Rs)', value: (r) => (r.unpaidPaisa / 100).toFixed(2) }], list);
  } else if (kind === 'monthly') {
    const r = await monthly(req.query.month || monthKey(new Date()));
    csv = toCsv([{ label: 'Item', value: 'label' }, { label: 'Entries', value: 'count' }, { label: 'Total (Rs)', value: (x) => (x.totalPaisa / 100).toFixed(2) }], r.rows);
  } else {
    throw new AppError(404, 'NOT_FOUND', 'Unknown export');
  }
  await audit(req, { action: 'report.export', actor: req.user, meta: { kind } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${kind}.csv"`);
  res.send(csv);
});

exports.summaryData = summary;
