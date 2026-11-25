process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLES, PERMISSIONS, ROLE_PERMISSIONS, hasPermission } = require('../src/constants/roles');
const { requirePermission, requireAnyPermission } = require('../src/middleware/authorize');

const run = (mw, role) => {
  let result = 'next';
  mw({ user: role ? { role } : undefined }, {}, (err) => { if (err) result = err.status; });
  return result;
};

test('every permission is granted to at least one role', () => {
  for (const p of Object.values(PERMISSIONS)) {
    assert.ok(Object.values(ROLES).some((r) => hasPermission(r, p)), `${p} is unused`);
  }
});

test('every role only lists known permissions and has no duplicates', () => {
  const known = new Set(Object.values(PERMISSIONS));
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    assert.equal(new Set(perms).size, perms.length, `${role} has duplicates`);
    perms.forEach((p) => assert.ok(known.has(p), `${role}: unknown ${p}`));
  }
});

test('separation of duties: nobody both records money and approves loans', () => {
  for (const r of Object.values(ROLES)) {
    const moneyIn = hasPermission(r, PERMISSIONS.TXN_DEPOSIT) || hasPermission(r, PERMISSIONS.TXN_WITHDRAW);
    assert.ok(!(moneyIn && hasPermission(r, PERMISSIONS.LOAN_APPROVE)), `${r} breaks separation of duties`);
  }
});

test('auditor is read-only', () => {
  const writes = [PERMISSIONS.TXN_DEPOSIT, PERMISSIONS.TXN_WITHDRAW, PERMISSIONS.TXN_REVERSE, PERMISSIONS.LOAN_APPROVE,
    PERMISSIONS.LOAN_DISBURSE, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_UPDATE_ROLE, PERMISSIONS.RATE_MANAGE];
  writes.forEach((p) => assert.equal(hasPermission(ROLES.AUDITOR, p), false, p));
  assert.equal(hasPermission(ROLES.AUDITOR, PERMISSIONS.LEDGER_VERIFY), true);
});

test('only administrators manage roles and rates', () => {
  for (const r of [ROLES.TELLER, ROLES.MEMBER, ROLES.AUDITOR]) {
    assert.equal(hasPermission(r, PERMISSIONS.USER_UPDATE_ROLE), false);
    assert.equal(hasPermission(r, PERMISSIONS.RATE_MANAGE), false);
  }
});

test('middleware returns 401 without a user and 403 without the permission', () => {
  const mw = requirePermission(PERMISSIONS.USER_CREATE);
  assert.equal(run(mw, null), 401);
  assert.equal(run(mw, ROLES.MEMBER), 403);
  assert.equal(run(mw, ROLES.ADMIN), 'next');
  assert.equal(run(requireAnyPermission(PERMISSIONS.LEDGER_VERIFY, PERMISSIONS.TXN_DEPOSIT), ROLES.TELLER), 'next');
});
