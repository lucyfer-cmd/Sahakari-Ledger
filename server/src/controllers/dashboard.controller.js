const asyncHandler = require('../utils/asyncHandler');
const SavingsAccount = require('../models/SavingsAccount');
const Loan = require('../models/Loan');
const Installment = require('../models/Installment');
const Notification = require('../models/Notification');
const LedgerEntry = require('../models/LedgerEntry');
const { summaryData } = require('./reports.controller');
const { remainingPaisa } = require('../services/loan.service');
const { markOverdue } = require('../services/jobs.service');
const { startOfDayUTC } = require('../utils/finance');
const { ROLES } = require('../constants/roles');

/** One call that gives each role the numbers for its home page. */
exports.get = asyncHandler(async (req, res) => {
  if (req.user.role !== ROLES.MEMBER) {
    const summary = await summaryData();
    const today = startOfDayUTC();
    const todays = await LedgerEntry.find({ createdAt: { $gte: today } }).lean();
    return res.json({
      role: req.user.role, summary,
      today: {
        entries: todays.length,
        depositsPaisa: todays.filter((e) => e.type === 'deposit').reduce((s, e) => s + e.amountPaisa, 0),
        withdrawalsPaisa: todays.filter((e) => e.type === 'withdrawal').reduce((s, e) => s + e.amountPaisa, 0),
      },
    });
  }
  await markOverdue();
  const accounts = req.user.member ? await SavingsAccount.find({ member: req.user.member, status: 'active' }) : [];
  const loan = req.user.member ? await Loan.findOne({ member: req.user.member, status: { $in: ['applied', 'approved', 'disbursed'] } }) : null;
  let installments = [];
  if (loan && loan.status === 'disbursed') installments = await Installment.find({ loan: loan._id }).sort({ no: 1 });
  const next = installments.find((i) => i.status !== 'paid') || null;
  const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.json({
    role: ROLES.MEMBER, accounts, loan, nextInstallment: next, remainingPaisa: installments.length ? remainingPaisa(installments) : 0, unreadNotifications: unread,
  });
});
