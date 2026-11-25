const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const User = require('../models/User');
const { ROLES } = require('../constants/roles');
const { validatePasswordStrength, hashPassword } = require('../services/password.service');
const { revokeAllForUser } = require('../services/token.service');
const { audit } = require('../services/audit.service');

async function assertNotLastAdmin(target) {
  if (target.role !== ROLES.ADMIN || target.status !== 'active') return;
  const others = await User.countDocuments({ role: ROLES.ADMIN, status: 'active', _id: { $ne: target._id } });
  if (others === 0) throw new AppError(409, 'LAST_ADMIN', 'At least one active administrator must remain');
}

/** POST /api/users: admin creates a staff account with a temporary password. */
exports.createStaff = asyncHandler(async (req, res) => {
  const { fullName, email, phone, role, temporaryPassword } = req.body;
  const problems = validatePasswordStrength(temporaryPassword, { email, fullName });
  if (problems.length) throw new AppError(400, 'WEAK_PASSWORD', 'Temporary password is too weak', problems.map((m) => ({ field: 'temporaryPassword', message: m })));

  const user = await User.create({
    fullName, email, phone, role,
    passwordHash: await hashPassword(temporaryPassword),
    status: 'active', mustChangePassword: true, createdBy: req.user._id,
  });
  await audit(req, { action: 'user.create', actor: req.user, entityType: 'User', entityId: user._id, meta: { role } });
  res.status(201).json({ user: user.toPublic() });
});

/** GET /api/users?status=&role= */
exports.listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.role) filter.role = req.query.role;
  // Tellers only manage members' accounts, so they only see those.
  if (req.user.role === ROLES.TELLER) filter.role = ROLES.MEMBER;
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({ users: users.map((u) => u.toPublic()) });
});

/** PATCH /api/users/:id/approve: staff approve a pending member account. */
exports.approveMember = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  if (user.role !== ROLES.MEMBER || user.status !== 'pending') {
    throw new AppError(409, 'NOT_PENDING_MEMBER', 'Only pending member accounts can be approved here');
  }
  user.status = 'active';
  await user.save();
  await audit(req, { action: 'user.approve', actor: req.user, entityType: 'User', entityId: user._id });
  res.json({ user: user.toPublic() });
});

/** PATCH /api/users/:id/role: admin only. Ends the user's sessions so the new role applies at once. */
exports.updateRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  if (user._id.equals(req.user._id)) throw new AppError(409, 'SELF_CHANGE', 'You cannot change your own role');
  if (req.body.role !== ROLES.ADMIN) await assertNotLastAdmin(user);

  const before = user.role;
  user.role = req.body.role;
  user.tokenVersion += 1;
  await user.save();
  await revokeAllForUser(user._id);
  await audit(req, { action: 'user.update_role', actor: req.user, entityType: 'User', entityId: user._id, meta: { from: before, to: user.role } });
  res.json({ user: user.toPublic() });
});

/** PATCH /api/users/:id/status: admin suspends or reactivates an account. */
exports.updateStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  if (user._id.equals(req.user._id)) throw new AppError(409, 'SELF_CHANGE', 'You cannot change your own status');
  if (req.body.status !== 'active') await assertNotLastAdmin(user);

  user.status = req.body.status;
  user.tokenVersion += 1;
  await user.save();
  if (req.body.status !== 'active') await revokeAllForUser(user._id);
  await audit(req, { action: 'user.update_status', actor: req.user, entityType: 'User', entityId: user._id, meta: { to: user.status } });
  res.json({ user: user.toPublic() });
});
