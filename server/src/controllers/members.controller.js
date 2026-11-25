const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const Member = require('../models/Member');
const SavingsAccount = require('../models/SavingsAccount');
const Loan = require('../models/Loan');
const User = require('../models/User');
const { nextSeq } = require('../models/Counter');
const { audit } = require('../services/audit.service');
const { paging, escapeRegex } = require('../middleware/validators');
const { hasPermission, PERMISSIONS } = require('../constants/roles');

const FIELDS = ['fullName', 'dob', 'gender', 'phone', 'email', 'address', 'nominee'];

exports.create = asyncHandler(async (req, res) => {
  if (await Member.exists({ phone: req.body.phone })) throw new AppError(409, 'DUPLICATE_PHONE', 'A member with this phone number already exists');
  const n = await nextSeq('member');
  const data = { membershipNo: `M-${String(n).padStart(4, '0')}`, createdBy: req.user._id };
  FIELDS.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
  const member = await Member.create(data);
  await audit(req, { action: 'member.create', actor: req.user, entityType: 'Member', entityId: member._id, meta: { membershipNo: member.membershipNo } });
  res.status(201).json({ member });
});

exports.list = asyncHandler(async (req, res) => {
  const { limit, page, skip } = paging(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ fullName: rx }, { membershipNo: rx }, { phone: rx }];
  }
  const [members, total] = await Promise.all([
    Member.find(filter).sort({ membershipNo: 1 }).skip(skip).limit(limit),
    Member.countDocuments(filter),
  ]);
  res.json({ members, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

exports.get = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  const [accounts, loans, login] = await Promise.all([
    SavingsAccount.find({ member: member._id }).sort({ openedAt: 1 }),
    Loan.find({ member: member._id }).sort({ appliedAt: -1 }),
    User.findOne({ member: member._id }),
  ]);
  res.json({ member, accounts, loans, login: login ? { id: login.id, email: login.email, status: login.status } : null });
});

exports.update = asyncHandler(async (req, res) => {
  const member = await Member.findById(req.params.id);
  if (!member) throw new AppError(404, 'NOT_FOUND', 'Member not found');
  if (req.body.phone && req.body.phone !== member.phone && (await Member.exists({ phone: req.body.phone, _id: { $ne: member._id } }))) {
    throw new AppError(409, 'DUPLICATE_PHONE', 'A member with this phone number already exists');
  }
  if (req.body.status && !hasPermission(req.user.role, PERMISSIONS.USER_UPDATE_STATUS)) {
    throw new AppError(403, 'FORBIDDEN', 'Only an administrator can suspend or close a member');
  }
  FIELDS.forEach((f) => { if (req.body[f] !== undefined) member.set(f, req.body[f]); });
  if (req.body.status) member.status = req.body.status;
  await member.save();
  await audit(req, { action: 'member.update', actor: req.user, entityType: 'Member', entityId: member._id, meta: { fields: Object.keys(req.body) } });
  res.json({ member });
});
