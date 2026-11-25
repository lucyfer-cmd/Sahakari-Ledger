const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const User = require('../models/User');
const Member = require('../models/Member');
const PasswordResetToken = require('../models/PasswordResetToken');
const { ROLES, permissionsFor } = require('../constants/roles');
const {
  validatePasswordStrength, hashPassword, verifyPassword, fakeVerify,
} = require('../services/password.service');
const tokens = require('../services/token.service');
const { audit } = require('../services/audit.service');
const { sendPasswordResetEmail } = require('../services/mail.service');

const meta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });
const GENERIC_LOGIN_ERROR = new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

const sessionPayload = (user) => ({
  user: user.toPublic(),
  permissions: permissionsFor(user.role),
});

function assertStrongPassword(password, user) {
  const problems = validatePasswordStrength(password, user);
  if (problems.length) throw new AppError(400, 'WEAK_PASSWORD', 'Password is too weak', problems.map((m) => ({ field: 'password', message: m })));
}

/** POST /api/auth/register: a member creates an account. It stays "pending" until staff approve it. */
exports.register = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, membershipNo } = req.body;

  // The person must already be a member: membership number and phone must match the member record.
  const member = await Member.findOne({ membershipNo, status: 'active' });
  const phoneMatches = member && member.phone && phone && member.phone.replace(/\D/g, '') === phone.replace(/\D/g, '');
  if (!member || !phoneMatches) {
    await audit(req, { action: 'auth.register', actorEmail: email, outcome: 'failure', meta: { reason: 'member_not_verified' } });
    throw new AppError(400, 'MEMBER_NOT_VERIFIED', 'We could not match these details to a cooperative member. Please check with the cooperative office.');
  }
  if (await User.exists({ member: member._id })) {
    throw new AppError(409, 'DUPLICATE', 'An account already exists for this member');
  }
  assertStrongPassword(password, { email, fullName });

  const user = await User.create({
    fullName, email, phone,
    passwordHash: await hashPassword(password),
    role: ROLES.MEMBER, status: 'pending', member: member._id,
  });
  await audit(req, { action: 'auth.register', actor: user, entityType: 'User', entityId: user._id });
  res.status(201).json({ message: 'Account created. A cooperative staff member must approve it before you can sign in.' });
});

/** POST /api/auth/login */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user) {
    await fakeVerify(password);
    await audit(req, { action: 'auth.login', actorEmail: email, outcome: 'failure', meta: { reason: 'unknown_email' } });
    throw GENERIC_LOGIN_ERROR;
  }
  if (user.isLocked()) {
    await audit(req, { action: 'auth.login', actor: user, outcome: 'failure', meta: { reason: 'locked' } });
    throw new AppError(423, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in a few minutes.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    user.failedLoginCount += 1;
    let locked = false;
    if (user.failedLoginCount >= env.MAX_FAILED_LOGINS) {
      user.lockUntil = new Date(Date.now() + env.LOCK_MINUTES * 60 * 1000);
      user.failedLoginCount = 0;
      locked = true;
    }
    await user.save();
    await audit(req, { action: locked ? 'auth.account_locked' : 'auth.login', actor: user, outcome: 'failure', meta: { reason: 'bad_password' } });
    throw GENERIC_LOGIN_ERROR;
  }

  // The password is correct, so it is now safe to say why the account cannot be used.
  if (user.status === 'pending') throw new AppError(403, 'ACCOUNT_PENDING', 'Your account is waiting for approval by the cooperative');
  if (user.status === 'suspended') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact the cooperative.');

  user.failedLoginCount = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  const refresh = await tokens.issueRefreshToken(user, meta(req));
  res.cookie(tokens.REFRESH_COOKIE, refresh.raw, tokens.refreshCookieOptions());
  await audit(req, { action: 'auth.login', actor: user });
  res.json({ accessToken: tokens.signAccessToken(user), ...sessionPayload(user) });
});

/** POST /api/auth/refresh: exchanges the refresh cookie for a new access token (and rotates the cookie). */
exports.refresh = asyncHandler(async (req, res) => {
  const rotated = await tokens.rotateRefreshToken(req.cookies[tokens.REFRESH_COOKIE], meta(req));
  const clear = () => res.clearCookie(tokens.REFRESH_COOKIE, { ...tokens.refreshCookieOptions(), maxAge: undefined });

  if (!rotated) { clear(); throw new AppError(401, 'REFRESH_INVALID', 'Please sign in again'); }
  if (rotated.reuseDetected) {
    clear();
    await audit(req, { action: 'auth.refresh_reuse_detected', actor: rotated.userId, outcome: 'failure' });
    throw new AppError(401, 'REFRESH_INVALID', 'Please sign in again');
  }
  const user = await User.findById(rotated.userId);
  if (!user || user.status !== 'active') { clear(); throw new AppError(401, 'REFRESH_INVALID', 'Please sign in again'); }

  res.cookie(tokens.REFRESH_COOKIE, rotated.raw, tokens.refreshCookieOptions());
  res.json({ accessToken: tokens.signAccessToken(user), ...sessionPayload(user) });
});

/** POST /api/auth/logout: revokes this device's refresh token. */
exports.logout = asyncHandler(async (req, res) => {
  await tokens.revokeRefreshToken(req.cookies[tokens.REFRESH_COOKIE]);
  res.clearCookie(tokens.REFRESH_COOKIE, { ...tokens.refreshCookieOptions(), maxAge: undefined });
  await audit(req, { action: 'auth.logout', actor: req.user });
  res.status(204).end();
});

/** POST /api/auth/logout-all: signs the user out of every device. */
exports.logoutAll = asyncHandler(async (req, res) => {
  await tokens.revokeAllForUser(req.user._id);
  req.user.tokenVersion += 1;
  await req.user.save();
  res.clearCookie(tokens.REFRESH_COOKIE, { ...tokens.refreshCookieOptions(), maxAge: undefined });
  await audit(req, { action: 'auth.logout_all', actor: req.user });
  res.status(204).end();
});

/** GET /api/auth/me */
exports.me = (req, res) => res.json(sessionPayload(req.user));

/** POST /api/auth/change-password: needs the current password. Ends all other sessions. */
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    await audit(req, { action: 'auth.change_password', actor: user, outcome: 'failure', meta: { reason: 'wrong_current' } });
    throw new AppError(400, 'WRONG_PASSWORD', 'Current password is incorrect');
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new AppError(400, 'PASSWORD_REUSED', 'Choose a password different from the current one');
  }
  assertStrongPassword(newPassword, user);

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  user.tokenVersion += 1; // invalidates access tokens issued before this change
  await user.save();
  await tokens.revokeAllForUser(user._id);

  const refresh = await tokens.issueRefreshToken(user, meta(req));
  res.cookie(tokens.REFRESH_COOKIE, refresh.raw, tokens.refreshCookieOptions());
  await audit(req, { action: 'auth.change_password', actor: user });
  res.json({ accessToken: tokens.signAccessToken(user), ...sessionPayload(user) });
});

/** POST /api/auth/forgot-password: always answers the same way so emails cannot be probed. */
exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email, status: 'active' });
  if (user) {
    await PasswordResetToken.updateMany({ user: user._id, usedAt: null }, { usedAt: new Date() }); // only the newest link works
    const raw = tokens.randomToken();
    await PasswordResetToken.create({
      user: user._id,
      tokenHash: tokens.sha256(raw),
      expiresAt: new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    });
    await sendPasswordResetEmail(user.email, `${env.CLIENT_ORIGIN}/reset-password?token=${raw}`);
    await audit(req, { action: 'auth.forgot_password', actor: user });
  }
  res.status(202).json({ message: 'If that email belongs to an account, a reset link has been sent.' });
});

/** POST /api/auth/reset-password */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const record = await PasswordResetToken.findOne({ tokenHash: tokens.sha256(token), usedAt: null, expiresAt: { $gt: new Date() } });
  if (!record) throw new AppError(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired');

  const user = await User.findById(record.user).select('+passwordHash');
  if (!user || user.status !== 'active') throw new AppError(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired');
  assertStrongPassword(newPassword, user);

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  user.failedLoginCount = 0;
  user.lockUntil = null;
  user.tokenVersion += 1;
  await user.save();
  record.usedAt = new Date();
  await record.save();
  await tokens.revokeAllForUser(user._id);
  await audit(req, { action: 'auth.reset_password', actor: user });
  res.json({ message: 'Password updated. You can now sign in.' });
});
