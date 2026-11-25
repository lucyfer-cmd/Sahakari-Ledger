process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../src/app');
const User = require('../src/models/User');
const { signAccessToken } = require('../src/services/token.service');

const app = createApp();

// These tests run without a database: they check validation, authentication and authorization,
// which all happen before any data is read. User lookup is stubbed.
const fakeUser = (role, extra = {}) => ({
  _id: { toString: () => '64b000000000000000000001', equals: () => false },
  role, status: 'active', tokenVersion: 0, mustChangePassword: false, ...extra,
});
const stubUser = (user) => { User.findById = async () => user; };

test('health check works', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('unknown routes return a JSON 404', async () => {
  const res = await request(app).get('/api/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('login rejects malformed input before touching the database', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(res.body.error.details.some((d) => d.field === 'email'));
});

test('register requires every field', async () => {
  const res = await request(app).post('/api/auth/register').send({ email: 'a@b.co' });
  assert.equal(res.status, 400);
  const fields = res.body.error.details.map((d) => d.field);
  for (const f of ['fullName', 'phone', 'membershipNo', 'password']) assert.ok(fields.includes(f), f);
});

test('operator injection in the body is neutralised or rejected', async () => {
  const res = await request(app).post('/api/auth/login').send({ email: { $ne: '' }, password: { $ne: '' } });
  assert.equal(res.status, 400);
});

test('protected routes need a token', async () => {
  assert.equal((await request(app).get('/api/users')).status, 401);
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  const bad = await request(app).get('/api/users').set('Authorization', 'Bearer garbage');
  assert.equal(bad.status, 401);
});

test('a member cannot list users or create staff (403)', async () => {
  const user = fakeUser('member');
  stubUser(user);
  const token = signAccessToken(user);
  const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 403);
  const create = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({});
  assert.equal(create.status, 403);
});

test('an auditor cannot change roles (403)', async () => {
  const user = fakeUser('auditor');
  stubUser(user);
  const res = await request(app).patch('/api/users/64b000000000000000000002/role')
    .set('Authorization', `Bearer ${signAccessToken(user)}`).send({ role: 'admin' });
  assert.equal(res.status, 403);
});

test('a token from before a password change is rejected', async () => {
  const user = fakeUser('teller');
  const oldToken = signAccessToken(user);
  stubUser({ ...user, tokenVersion: 1 }); // user changed password after the token was issued
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
  assert.equal(res.status, 401);
});

test('an account that must change its password is blocked from other routes', async () => {
  const user = fakeUser('teller', { mustChangePassword: true });
  stubUser(user);
  const res = await request(app).get('/api/users').set('Authorization', `Bearer ${signAccessToken(user)}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'PASSWORD_CHANGE_REQUIRED');
});
