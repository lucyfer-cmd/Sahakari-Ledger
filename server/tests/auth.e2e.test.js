// End-to-end test of the whole auth flow against a real MongoDB-compatible database.
// It is skipped unless E2E_MONGO_URI is set, so `npm test` still works on a laptop without MongoDB.
//   E2E_MONGO_URI=mongodb://127.0.0.1:27017/sahakari_test npm test
process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');

const URI = process.env.E2E_MONGO_URI;
const skip = URI ? false : 'set E2E_MONGO_URI to run the end-to-end auth tests';

// Capture the reset link instead of sending an email. This must happen before the app is loaded.
let lastResetLink = null;
require('../src/services/mail.service').sendPasswordResetEmail = async (to, link) => { lastResetLink = link; };

const mongoose = require('mongoose');
const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const Member = require('../src/models/Member');
const RefreshToken = require('../src/models/RefreshToken');
const AuditLog = require('../src/models/AuditLog');
const { hashPassword } = require('../src/services/password.service');

const STRONG = 'Coop#Ledger2026';
const STRONGER = 'River#Stone8841';
const app = createApp();

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const refreshCookie = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('sl_refresh='));
const cookieValue = (c) => c.split(';')[0];

let admin; // { token }
let memberUserId;

test('setup: clean database, one admin, one member record', { skip }, async () => {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  await User.create({ fullName: 'Asha Admin', email: 'admin@coop.test', passwordHash: await hashPassword('Temp#Pass2026x'),
    role: 'admin', status: 'active', mustChangePassword: true });
  await Member.create({ membershipNo: 'M-0001', fullName: 'Sita Rai', phone: '9800000001' });
});

test('registration: unknown member, weak password and a good request', { skip }, async () => {
  const base = { fullName: 'Sita Rai', email: 'sita@coop.test', phone: '9800000001', membershipNo: 'M-0001', password: STRONG };
  let res = await request(app).post('/api/auth/register').send({ ...base, membershipNo: 'M-9999' });
  assert.equal(res.status, 400); assert.equal(res.body.error.code, 'MEMBER_NOT_VERIFIED');
  res = await request(app).post('/api/auth/register').send({ ...base, phone: '9811111111' });
  assert.equal(res.body.error.code, 'MEMBER_NOT_VERIFIED');
  res = await request(app).post('/api/auth/register').send({ ...base, password: 'short' });
  assert.equal(res.body.error.code, 'WEAK_PASSWORD');
  res = await request(app).post('/api/auth/register').send(base);
  assert.equal(res.status, 201);
  res = await request(app).post('/api/auth/register').send({ ...base, email: 'other@coop.test' });
  assert.equal(res.status, 409); // the same member cannot register twice
  const u = await User.findOne({ email: 'sita@coop.test' });
  assert.equal(u.status, 'pending'); assert.equal(u.role, 'member');
  memberUserId = u._id.toString();
});

test('pending account cannot log in, wrong password and unknown email look the same', { skip }, async () => {
  let res = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONG });
  assert.equal(res.status, 403); assert.equal(res.body.error.code, 'ACCOUNT_PENDING');
  const wrongPw = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: 'Wrong#Pass2026' });
  const noUser = await request(app).post('/api/auth/login').send({ email: 'nobody@coop.test', password: 'Wrong#Pass2026' });
  assert.equal(wrongPw.status, 401); assert.equal(noUser.status, 401);
  assert.deepEqual(wrongPw.body, noUser.body);
});

test('admin: forced password change, then user management works', { skip }, async () => {
  let res = await request(app).post('/api/auth/login').send({ email: 'admin@coop.test', password: 'Temp#Pass2026x' });
  assert.equal(res.status, 200); assert.equal(res.body.user.mustChangePassword, true);
  assert.ok(res.body.permissions.includes('user:create'));
  const t0 = res.body.accessToken;
  res = await request(app).get('/api/users').set(bearer(t0));
  assert.equal(res.status, 403); assert.equal(res.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
  res = await request(app).post('/api/auth/change-password').set(bearer(t0)).send({ currentPassword: 'Temp#Pass2026x', newPassword: 'Temp#Pass2026x' });
  assert.equal(res.body.error.code, 'PASSWORD_REUSED');
  res = await request(app).post('/api/auth/change-password').set(bearer(t0)).send({ currentPassword: 'wrong', newPassword: STRONGER });
  assert.equal(res.body.error.code, 'WRONG_PASSWORD');
  res = await request(app).post('/api/auth/change-password').set(bearer(t0)).send({ currentPassword: 'Temp#Pass2026x', newPassword: STRONGER });
  assert.equal(res.status, 200); admin = { token: res.body.accessToken };
  res = await request(app).get('/api/users?status=pending').set(bearer(t0));
  assert.equal(res.status, 401); // the old token died when the password changed
  res = await request(app).get('/api/users?status=pending').set(bearer(admin.token));
  assert.equal(res.status, 200); assert.equal(res.body.users.length, 1);
});

test('admin creates a teller; teller approves the member; member can then log in', { skip }, async () => {
  let res = await request(app).post('/api/users').set(bearer(admin.token))
    .send({ fullName: 'Tara Teller', email: 'tara@coop.test', role: 'teller', temporaryPassword: 'Temp#Pass2026y' });
  assert.equal(res.status, 201);
  res = await request(app).post('/api/users').set(bearer(admin.token))
    .send({ fullName: 'Bad Role', email: 'bad@coop.test', role: 'member', temporaryPassword: 'Temp#Pass2026y' });
  assert.equal(res.status, 400); // members cannot be created through the staff endpoint

  res = await request(app).post('/api/auth/login').send({ email: 'tara@coop.test', password: 'Temp#Pass2026y' });
  res = await request(app).post('/api/auth/change-password').set(bearer(res.body.accessToken)).send({ currentPassword: 'Temp#Pass2026y', newPassword: STRONGER });
  const teller = res.body.accessToken;

  res = await request(app).post('/api/users').set(bearer(teller)).send({});
  assert.equal(res.status, 403); // a teller cannot create staff
  res = await request(app).patch(`/api/users/${memberUserId}/role`).set(bearer(teller)).send({ role: 'admin' });
  assert.equal(res.status, 403); // a teller cannot change roles
  res = await request(app).get('/api/users').set(bearer(teller));
  assert.ok(res.body.users.every((u) => u.role === 'member')); // tellers only see member accounts
  res = await request(app).patch(`/api/users/${memberUserId}/approve`).set(bearer(teller));
  assert.equal(res.status, 200); assert.equal(res.body.user.status, 'active');
  res = await request(app).patch(`/api/users/${memberUserId}/approve`).set(bearer(teller));
  assert.equal(res.status, 409); // already approved

  res = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONG });
  assert.equal(res.status, 200); assert.equal(res.body.user.role, 'member');
  res = await request(app).get('/api/users').set(bearer(res.body.accessToken));
  assert.equal(res.status, 403); // a member cannot list users
});

test('refresh tokens rotate, reuse is detected, logout revokes', { skip }, async () => {
  const agent = request.agent(app);
  let res = await agent.post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONG });
  const firstCookie = cookieValue(refreshCookie(res));
  assert.ok(refreshCookie(res).includes('HttpOnly'));
  res = await agent.post('/api/auth/refresh');
  assert.equal(res.status, 200); assert.ok(res.body.accessToken);
  const secondCookie = cookieValue(refreshCookie(res));
  assert.notEqual(firstCookie, secondCookie);
  // replaying the OLD refresh token must fail and kill the whole token family
  res = await request(app).post('/api/auth/refresh').set('Cookie', firstCookie);
  assert.equal(res.status, 401);
  res = await request(app).post('/api/auth/refresh').set('Cookie', secondCookie);
  assert.equal(res.status, 401);
  // logout
  const agent2 = request.agent(app);
  res = await agent2.post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONG });
  const token = res.body.accessToken;
  res = await agent2.post('/api/auth/logout').set(bearer(token));
  assert.equal(res.status, 204);
  res = await agent2.post('/api/auth/refresh');
  assert.equal(res.status, 401);
  // only hashes are stored, never the raw token
  const stored = await RefreshToken.find({});
  assert.ok(stored.every((t) => t.tokenHash.length === 64 && !firstCookie.includes(t.tokenHash)));
});

test('five wrong passwords lock the account, even for the right password', { skip }, async () => {
  await User.create({ fullName: 'Lock Me', email: 'lock@coop.test', passwordHash: await hashPassword(STRONG), role: 'auditor', status: 'active' });
  for (let i = 0; i < 5; i += 1) {
    const r = await request(app).post('/api/auth/login').send({ email: 'lock@coop.test', password: 'Wrong#Pass2026' });
    assert.equal(r.status, 401);
  }
  const res = await request(app).post('/api/auth/login').send({ email: 'lock@coop.test', password: STRONG });
  assert.equal(res.status, 423); assert.equal(res.body.error.code, 'ACCOUNT_LOCKED');
});

test('forgot and reset password: same answer for any email, one-time link, sessions end', { skip }, async () => {
  let res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@coop.test' });
  assert.equal(res.status, 202); const unknownBody = res.body; assert.equal(lastResetLink, null);
  const login = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONG });
  const oldToken = login.body.accessToken;
  res = await request(app).post('/api/auth/forgot-password').send({ email: 'sita@coop.test' });
  assert.equal(res.status, 202); assert.deepEqual(res.body, unknownBody);
  assert.ok(lastResetLink && lastResetLink.includes('/reset-password?token='));
  const token = new URL(lastResetLink).searchParams.get('token');
  res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'weak' });
  assert.equal(res.body.error.code, 'WEAK_PASSWORD');
  res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: STRONGER });
  assert.equal(res.status, 200);
  res = await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'Another#Pass9912' });
  assert.equal(res.body.error.code, 'RESET_TOKEN_INVALID'); // links work once
  res = await request(app).get('/api/auth/me').set(bearer(oldToken));
  assert.equal(res.status, 401); // old session ended
  res = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONG });
  assert.equal(res.status, 401);
  res = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONGER });
  assert.equal(res.status, 200);
});

test('role change and suspension take effect at once; admins cannot change themselves', { skip }, async () => {
  const sita = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONGER });
  let res = await request(app).patch(`/api/users/${memberUserId}/role`).set(bearer(admin.token)).send({ role: 'auditor' });
  assert.equal(res.status, 200);
  res = await request(app).get('/api/auth/me').set(bearer(sita.body.accessToken));
  assert.equal(res.status, 401); // her old token no longer works
  res = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONGER });
  assert.equal(res.body.user.role, 'auditor');
  res = await request(app).patch(`/api/users/${memberUserId}/status`).set(bearer(admin.token)).send({ status: 'suspended' });
  assert.equal(res.status, 200);
  res = await request(app).post('/api/auth/login').send({ email: 'sita@coop.test', password: STRONGER });
  assert.equal(res.status, 403); assert.equal(res.body.error.code, 'ACCOUNT_SUSPENDED');

  const adminUser = await User.findOne({ email: 'admin@coop.test' });
  res = await request(app).patch(`/api/users/${adminUser._id}/role`).set(bearer(admin.token)).send({ role: 'teller' });
  assert.equal(res.status, 409); assert.equal(res.body.error.code, 'SELF_CHANGE');
  // a second admin exists only if we make one; demoting the only other admin must be blocked
  const second = await User.create({ fullName: 'Second Admin', email: 'a2@coop.test', passwordHash: await hashPassword(STRONG), role: 'admin', status: 'active' });
  res = await request(app).patch(`/api/users/${second._id}/role`).set(bearer(admin.token)).send({ role: 'teller' });
  assert.equal(res.status, 200); // fine: the first admin remains
});

test('the audit log recorded the important events', { skip }, async () => {
  const actions = (await AuditLog.find({}).lean()).map((a) => a.action);
  for (const a of ['auth.register', 'auth.login', 'auth.change_password', 'user.create', 'user.approve', 'user.update_role',
    'user.update_status', 'auth.account_locked', 'auth.forgot_password', 'auth.reset_password', 'auth.logout', 'auth.refresh_reuse_detected']) {
    assert.ok(actions.includes(a), `missing audit action ${a}`);
  }
  const text = JSON.stringify(await AuditLog.find({}).lean());
  assert.ok(!text.includes(STRONG) && !text.includes(STRONGER)); // never log passwords
});

test('teardown', { skip }, async () => { await mongoose.disconnect(); });
