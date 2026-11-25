const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Loan = require('../models/Loan');
const Installment = require('../models/Installment');
const Member = require('../models/Member');
const SavingsAccount = require('../models/SavingsAccount');
const InterestRate = require('../models/InterestRate');
const { nextSeq } = require('../models/Counter');
const ledger = require('../services/ledger.service');
const { computeRisk, maxLoanPaisa } = require('../services/risk.service');
const { overdueList, remainingPaisa } = require('../services/loan.service');
const { markOverdue } = require('../services/jobs.service');
const { notifyMember } = require('../services/notification.service');
const { audit } = require('../services/audit.service');
const { toPaisa, emiFor, buildSchedule, startOfDayUTC } = require('../utils/finance');
const { MIN_LOAN_PAISA, MAX_LOAN_MULTIPLE, MIN_TERM_MONTHS, MAX_TERM_MONTHS } = require('../config/business');
const { hasPermission, PERMISSIONS: P } = require('../constants/roles');
const { paging } = require('../middleware/validators');

const rs = (p) => `Rs ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function loadLoan(req) {
  const loan = await Loan.findById(req.params.id).populate('member', 'fullName membershipNo phone').populate('account', 'accountNo');
  if (!loan) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  const staff = hasPermission(req.user.role, P.LOAN_READ);
  const own = hasPermission(req.user.role, P.LOAN_READ_OWN) && req.user.member && String(loan.member._id) === String(req.user.member);
  if (!staff && !own) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  return loan;
}

/** Member applies for a loan. The risk score is worked out immediately so the approver can see it. */
exports.apply = asyncHandler(async (req, res) => {
  if (!req.user.member) throw new AppError(409, 'NO_MEMBER', 'Your login is not linked to a member record');
  const member = await Member.findById(req.user.member);
  if (!member || member.status !== 'active') throw new AppError(409, 'MEMBER_NOT_ACTIVE', 'Your membership is not active');
  const account = await SavingsAccount.findOne({ member: member._id, status: 'active' }).sort({ openedAt: 1 });
  if (!account) throw new AppError(409, 'NO_ACCOUNT', 'You need a savings account before you can apply for a loan');
  if (await Loan.exists({ member: member._id, status: { $in: ['applied', 'approved', 'disbursed'] } })) {
    throw new AppError(409, 'OPEN_LOAN', 'You already have a loan that is not finished');
  }
  const principalPaisa = toPaisa(req.body.amount);
  const termMonths = req.body.termMonths;
  if (principalPaisa < MIN_LOAN_PAISA) throw new AppError(400, 'AMOUNT_TOO_SMALL', `The smallest loan is ${rs(MIN_LOAN_PAISA)}`);
  if (principalPaisa > maxLoanPaisa(account.balancePaisa)) {
    throw new AppError(409, 'EXCEEDS_LIMIT', `A loan can be at most ${MAX_LOAN_MULTIPLE} times your savings. Your limit is ${rs(maxLoanPaisa(account.balancePaisa))}.`);
  }

  // Risk inputs from the member's history
  const now = new Date();
  const pastLoans = await Loan.find({ member: member._id, status: { $in: ['disbursed', 'closed'] } }).lean();
  const installments = pastLoans.length ? await Installment.find({ loan: { $in: pastLoans.map((l) => l._id) }, dueDate: { $lte: now } }).lean() : [];
  const paidShare = installments.length ? installments.filter((i) => i.paidPaisa >= i.principalDuePaisa + i.interestDuePaisa).length / installments.length : null;
  const overdueCount = installments.filter((i) => i.status === 'overdue').length;
  const memberSinceMonths = Math.max(0, (now - member.joinedAt) / (30.44 * 86400000));
  const risk = computeRisk({ memberSinceMonths, savingsBalancePaisa: account.balancePaisa, principalPaisa, paidShare, overdueCount });

  const n = await nextSeq('loan');
  const loan = await Loan.create({
    loanNo: `L-${String(n).padStart(4, '0')}`, member: member._id, account: account._id, principalPaisa, termMonths,
    purpose: req.body.purpose || '', riskScore: risk.score, riskBand: risk.band, riskBreakdown: risk.factors,
  });
  await audit(req, { action: 'loan.apply', actor: req.user, entityType: 'Loan', entityId: loan._id, meta: { loanNo: loan.loanNo, principalPaisa, termMonths, riskScore: risk.score } });
  res.status(201).json({ loan });
});

exports.list = asyncHandler(async (req, res) => {
  await markOverdue();
  const { limit, page, skip } = paging(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.memberId) filter.member = req.query.memberId;
  const [loans, total] = await Promise.all([
    Loan.find(filter).sort({ appliedAt: -1 }).skip(skip).limit(limit).populate('member', 'fullName membershipNo'),
    Loan.countDocuments(filter),
  ]);
  res.json({ loans, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

exports.mine = asyncHandler(async (req, res) => {
  const loans = req.user.member ? await Loan.find({ member: req.user.member }).sort({ appliedAt: -1 }).populate('account', 'accountNo') : [];
  res.json({ loans });
});

exports.overdue = asyncHandler(async (req, res) => {
  await markOverdue();
  res.json({ overdue: await overdueList() });
});

exports.get = asyncHandler(async (req, res) => {
  await markOverdue();
  const loan = await loadLoan(req);
  const installments = await Installment.find({ loan: loan._id }).sort({ no: 1 });
  const rate = loan.annualRatePct === null ? await InterestRate.current('loan') : null;
  const previewEmiPaisa = loan.emiPaisa || (rate ? emiFor(loan.principalPaisa, rate.ratePct, loan.termMonths) : null);
  res.json({ loan, installments, remainingPaisa: remainingPaisa(installments), previewEmiPaisa });
});

exports.approve = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  if (loan.status !== 'applied') throw new AppError(409, 'BAD_STATUS', 'Only an applied loan can be approved');
  const rate = await InterestRate.current('loan');
  if (!rate) throw new AppError(409, 'RATE_NOT_SET', 'Set the loan interest rate before approving loans');
  loan.status = 'approved';
  loan.annualRatePct = rate.ratePct;
  loan.emiPaisa = emiFor(loan.principalPaisa, rate.ratePct, loan.termMonths);
  loan.reviewedBy = req.user._id; loan.reviewedAt = new Date(); loan.reviewNote = req.body.note || '';
  await loan.save();
  await audit(req, { action: 'loan.approve', actor: req.user, entityType: 'Loan', entityId: loan._id, meta: { loanNo: loan.loanNo, ratePct: rate.ratePct } });
  await notifyMember(loan.member, 'loan_approved', `Your loan ${loan.loanNo} for ${rs(loan.principalPaisa)} was approved. It will be paid into your savings account.`);
  res.json({ loan });
});

exports.reject = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  if (loan.status !== 'applied') throw new AppError(409, 'BAD_STATUS', 'Only an applied loan can be rejected');
  loan.status = 'rejected'; loan.reviewedBy = req.user._id; loan.reviewedAt = new Date(); loan.reviewNote = req.body.note;
  await loan.save();
  await audit(req, { action: 'loan.reject', actor: req.user, entityType: 'Loan', entityId: loan._id, meta: { loanNo: loan.loanNo } });
  await notifyMember(loan.member, 'loan_rejected', `Your loan ${loan.loanNo} was not approved. Reason: ${loan.reviewNote}`);
  res.json({ loan });
});

/** Pays the loan into the member's savings account, creates the repayment schedule, and records it in the ledger. */
exports.disburse = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  if (loan.status !== 'approved') throw new AppError(409, 'BAD_STATUS', 'Only an approved loan can be disbursed');
  const schedule = buildSchedule({ principalPaisa: loan.principalPaisa, annualRatePct: loan.annualRatePct, termMonths: loan.termMonths, startDate: startOfDayUTC() });
  const rows = await Installment.insertMany(schedule.rows.map((r) => ({ ...r, loan: loan._id })));
  try {
    await ledger.postDisbursement(loan.account, loan._id, loan.principalPaisa, req.user._id, `Loan ${loan.loanNo} disbursed`);
  } catch (err) {
    await Installment.deleteMany({ _id: { $in: rows.map((r) => r._id) } }); // undo the schedule if the money could not be posted
    throw err;
  }
  loan.status = 'disbursed'; loan.disbursedAt = new Date(); loan.disbursedBy = req.user._id; loan.emiPaisa = schedule.emiPaisa;
  await loan.save();
  await audit(req, { action: 'loan.disburse', actor: req.user, entityType: 'Loan', entityId: loan._id, meta: { loanNo: loan.loanNo, principalPaisa: loan.principalPaisa } });
  await notifyMember(loan.member, 'loan_disbursed', `Loan ${loan.loanNo} (${rs(loan.principalPaisa)}) was paid into your savings account. Monthly instalment: ${rs(schedule.emiPaisa)}.`);
  res.json({ loan, installments: rows, totalInterestPaisa: schedule.totalInterestPaisa });
});

/** Teller collects cash. The payment clears the oldest unpaid instalments first. */
exports.repay = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new AppError(404, 'NOT_FOUND', 'Loan not found');
  if (loan.status !== 'disbursed') throw new AppError(409, 'BAD_STATUS', 'Repayments can only be collected on a disbursed loan');
  await markOverdue();
  const installments = await Installment.find({ loan: loan._id }).sort({ no: 1 });
  const amountPaisa = toPaisa(req.body.amount);
  const left = remainingPaisa(installments);
  if (amountPaisa > left) throw new AppError(409, 'OVERPAYMENT', `Only ${rs(left)} is still due on this loan`);

  const entry = await ledger.postRepayment(loan._id, amountPaisa, req.user._id, req.body.memo || `Repayment for ${loan.loanNo}`);
  let remaining = amountPaisa; const today = startOfDayUTC();
  for (const inst of installments) {
    if (remaining <= 0) break;
    const due = inst.principalDuePaisa + inst.interestDuePaisa - inst.paidPaisa;
    if (due <= 0) continue;
    const pay = Math.min(remaining, due);
    inst.paidPaisa += pay; remaining -= pay;
    if (inst.paidPaisa >= inst.principalDuePaisa + inst.interestDuePaisa) { inst.status = 'paid'; inst.paidAt = new Date(); }
    else inst.status = inst.dueDate < today ? 'overdue' : 'partial';
    await inst.save();
  }
  const closed = remainingPaisa(installments) === 0;
  if (closed) { loan.status = 'closed'; loan.closedAt = new Date(); await loan.save(); }
  await audit(req, { action: 'loan.repay', actor: req.user, entityType: 'Loan', entityId: loan._id, meta: { loanNo: loan.loanNo, amountPaisa, closed } });
  res.status(201).json({ entry, loan, installments, remainingPaisa: remainingPaisa(installments), closed });
});
