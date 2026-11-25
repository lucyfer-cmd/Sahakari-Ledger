const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Member = require('../models/Member');
const SavingsAccount = require('../models/SavingsAccount');
const LedgerEntry = require('../models/LedgerEntry');
const { nextSeq } = require('../models/Counter');
const ledger = require('../services/ledger.service');
const { statementPdf } = require('../services/pdf.service');
const { audit } = require('../services/audit.service');
const { toPaisa } = require('../utils/finance');
const { hasPermission, PERMISSIONS: P } = require('../constants/roles');

/** Staff can see any account. A member can only see their own: for anyone else it looks like it does not exist. */
async function loadAccount(req) {
  const account = await SavingsAccount.findById(req.params.id).populate('member', 'fullName membershipNo phone status');
  if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found');
  const staff = hasPermission(req.user.role, P.ACCOUNT_READ);
  const own = hasPermission(req.user.role, P.ACCOUNT_READ_OWN) && req.user.member && String(account.member._id) === String(req.user.member);
  if (!staff && !own) throw new AppError(404, 'NOT_FOUND', 'Account not found');
  return account;
}

exports.open = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.body.memberId);
  if (!member) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  if (member.status !== 'active') throw new AppError(409, 'MEMBER_NOT_ACTIVE', 'Only active members can open an account');
  const n = await nextSeq('account');
  const account = await SavingsAccount.create({ accountNo: `SA-${String(n).padStart(4, '0')}`, member: member._id, openedBy: req.user._id });
  await audit(req, { action: 'account.open', actor: req.user, entityType: 'SavingsAccount', entityId: account._id, meta: { accountNo: account.accountNo, membershipNo: member.membershipNo } });
  res.status(201).json({ account });
});

exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.memberId) filter.member = req.query.memberId;
  if (req.query.status) filter.status = req.query.status;
  const accounts = await SavingsAccount.find(filter).populate('member', 'fullName membershipNo').sort({ accountNo: 1 }).limit(200);
  res.json({ accounts });
});

exports.mine = asyncHandler(async (req, res) => {
  const accounts = req.user.member ? await SavingsAccount.find({ member: req.user.member }).sort({ accountNo: 1 }) : [];
  res.json({ accounts });
});

exports.get = asyncHandler(async (req, res) => res.json({ account: await loadAccount(req) }));

const moneyAction = (fn) => asyncHandler(async (req, res) => {
  const account = await SavingsAccount.findById(req.params.id);
  if (!account) throw new AppError(404, 'NOT_FOUND', 'Account not found');
  const entry = await fn(account._id, toPaisa(req.body.amount), req.user._id, req.body.memo || '');
  const fresh = await SavingsAccount.findById(account._id);
  res.status(201).json({ entry, balancePaisa: fresh.balancePaisa });
});
exports.deposit = moneyAction(ledger.deposit);
exports.withdraw = moneyAction(ledger.withdraw);

/** Statement for an account between two dates, with opening and closing balance. */
async function buildStatement(account, fromQ, toQ) {
  const from = fromQ ? new Date(fromQ) : null;
  const to = toQ ? new Date(new Date(toQ).getTime() + 86400000 - 1) : null;
  const filter = { account: account._id };
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  const entries = await LedgerEntry.find(filter).sort({ seq: 1 }).lean();
  let openingPaisa = 0;
  if (from) {
    const before = await LedgerEntry.findOne({ account: account._id, createdAt: { $lt: from } }).sort({ seq: -1 }).lean();
    openingPaisa = before ? before.balanceAfterPaisa : 0;
  }
  const closingPaisa = entries.length ? entries[entries.length - 1].balanceAfterPaisa : openingPaisa;
  return { from, to, openingPaisa, closingPaisa, entries };
}

exports.statement = asyncHandler(async (req, res) => {
  const account = await loadAccount(req);
  const st = await buildStatement(account, req.query.from, req.query.to);
  if (req.query.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${account.accountNo}.pdf"`);
    return statementPdf(res, { member: account.member, account, ...st });
  }
  res.json({ account, openingPaisa: st.openingPaisa, closingPaisa: st.closingPaisa, entries: st.entries.map((e) => ({ ...e, id: e._id, _id: undefined })) });
});
