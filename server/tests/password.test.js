process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePasswordStrength, hashPassword, verifyPassword } = require('../src/services/password.service');

test('accepts a strong password', () => {
  assert.deepEqual(validatePasswordStrength('Coop#Ledger2026', { email: 'ram@example.com', fullName: 'Hari Thapa' }), []);
});

test('rejects short, simple and common passwords', () => {
  assert.ok(validatePasswordStrength('Ab1!').length > 0);
  assert.ok(validatePasswordStrength('alllowercase1234!').some((m) => /upper/i.test(m)));
  assert.ok(validatePasswordStrength('NoDigitsHere!!').some((m) => /digit/i.test(m)));
  assert.ok(validatePasswordStrength('NoSymbols12345').some((m) => /symbol/i.test(m)));
});

test('rejects passwords that contain the email name or first name', () => {
  assert.ok(validatePasswordStrength('Ramesh#2026Ledger', { email: 'ramesh@example.com' }).some((m) => /email/i.test(m)));
  assert.ok(validatePasswordStrength('Sunita#2026Ledger', { fullName: 'Sunita Rai' }).some((m) => /name/i.test(m)));
});

test('hashes are salted and verify correctly', async () => {
  const a = await hashPassword('Coop#Ledger2026');
  const b = await hashPassword('Coop#Ledger2026');
  assert.notEqual(a, b);
  assert.ok(a.startsWith('$2'));
  assert.equal(await verifyPassword('Coop#Ledger2026', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
});
