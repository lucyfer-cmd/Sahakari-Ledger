const Installment = require('../models/Installment');
const Loan = require('../models/Loan');
const SavingsAccount = require('../models/SavingsAccount');
const LedgerEntry = require('../models/LedgerEntry');
const InterestRate = require('../models/InterestRate');
const ledger = require('./ledger.service');
const { notifyMember } = require('./notification.service');
const { startOfDayUTC, previousMonthKey } = require('../utils/finance');
const { REMINDER_DAYS } = require('../config/business');

const rs = (p) => `Rs ${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Instalments past their due date and not fully paid become "overdue". */
async function markOverdue(now = new Date()) {
  const res = await Installment.updateMany(
    { status: { $in: ['pending', 'partial'] }, dueDate: { $lt: startOfDayUTC(now) } },
    { $set: { status: 'overdue' } }
  );
  return res.modifiedCount ?? res.nModified ?? 0;
}

/** Reminders: due within a few days, and overdue. Each instalment is reminded only once per kind. */
async function sendReminders(now = new Date()) {
  const today = startOfDayUTC(now);
  const soon = new Date(today.getTime() + REMINDER_DAYS * 86400000);
  let sent = 0;
  const upcoming = await Installment.find({ status: { $in: ['pending', 'partial'] }, dueDate: { $gte: today, $lte: soon } });
  for (const inst of upcoming) {
    const loan = await Loan.findById(inst.loan);
    if (!loan || loan.status !== 'disbursed') continue;
    const left = inst.principalDuePaisa + inst.interestDuePaisa - inst.paidPaisa;
    const n = await notifyMember(loan.member, 'due_soon', `Instalment ${inst.no} of loan ${loan.loanNo} (${rs(left)}) is due on ${inst.dueDate.toISOString().slice(0, 10)}.`, `due:${inst._id}`);
    if (n) sent += 1;
  }
  const late = await Installment.find({ status: 'overdue' });
  for (const inst of late) {
    const loan = await Loan.findById(inst.loan);
    if (!loan || loan.status !== 'disbursed') continue;
    const left = inst.principalDuePaisa + inst.interestDuePaisa - inst.paidPaisa;
    const n = await notifyMember(loan.member, 'overdue', `Instalment ${inst.no} of loan ${loan.loanNo} is overdue (${rs(left)} unpaid). Please contact the cooperative.`, `overdue:${inst._id}`);
    if (n) sent += 1;
  }
  return sent;
}

/**
 * Monthly savings interest for the previous month, posted at most once per account per month.
 * Simplification: it uses the current balance. A real system would use the daily average balance.
 */
async function postMonthlyInterest(now = new Date()) {
  const period = previousMonthKey(now);
  const rate = await InterestRate.current('savings', now);
  if (!rate || rate.ratePct <= 0) return { period, posted: 0, skipped: 'no savings rate set' };
  let posted = 0;
  const accounts = await SavingsAccount.find({ status: 'active', balancePaisa: { $gt: 0 } });
  for (const a of accounts) {
    if (await LedgerEntry.exists({ type: 'interest', account: a._id, period })) continue;
    const amount = Math.round((a.balancePaisa * rate.ratePct) / 100 / 12);
    if (amount <= 0) continue;
    await ledger.postInterest(a._id, amount, period);
    posted += 1;
  }
  return { period, posted };
}

/** Everything the system does by itself. Safe to run any number of times. */
async function runDailyJobs(now = new Date()) {
  const overdueMarked = await markOverdue(now);
  const remindersSent = await sendReminders(now);
  const interest = await postMonthlyInterest(now);
  let checkpoint = null;
  try { checkpoint = (await ledger.createCheckpoint(null)).created; } catch (err) { checkpoint = false; }
  return { overdueMarked, remindersSent, interest, checkpointCreated: checkpoint, ranAt: now };
}

let timer = null;
/** Runs the daily jobs once at start-up and then every 24 hours. */
function startScheduler() {
  const run = () => runDailyJobs().then((r) => console.log('[jobs]', JSON.stringify(r))).catch((e) => console.error('[jobs] failed:', e.message));
  setTimeout(run, 5000);
  timer = setInterval(run, 24 * 60 * 60 * 1000);
  timer.unref();
}

module.exports = { markOverdue, sendReminders, postMonthlyInterest, runDailyJobs, startScheduler };
