process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeHash, canonical, GENESIS } = require('../src/services/ledger.service');

const base = () => ({
  seq: 7, prevHash: GENESIS, type: 'deposit', amountPaisa: 500000, deltaPaisa: 500000, account: '64b0000000000000000000aa', loan: null,
  balanceAfterPaisa: 500000, recordedBy: '64b0000000000000000000bb', createdAt: new Date('2026-11-02T10:05:00.000Z'), memo: 'cash', reversalOf: null, period: '',
});

test('the same entry always gives the same hash', () => {
  assert.equal(computeHash(base()), computeHash(base()));
  assert.match(computeHash(base()), /^[0-9a-f]{64}$/);
});

test('changing ANY field changes the hash (this is what makes tampering visible)', () => {
  const h = computeHash(base());
  const changes = [{ amountPaisa: 500001 }, { deltaPaisa: 1 }, { type: 'withdrawal' }, { seq: 8 }, { prevHash: '1'.repeat(64) }, { account: '64b0000000000000000000ab' },
    { balanceAfterPaisa: 1 }, { recordedBy: '64b0000000000000000000bc' }, { createdAt: new Date('2026-11-02T10:05:00.001Z') }, { memo: 'Cash' }, { period: '2026-10' }];
  for (const c of changes) assert.notEqual(computeHash({ ...base(), ...c }), h, JSON.stringify(c));
});

test('the canonical text contains every protected field', () => {
  const parts = JSON.parse(canonical(base()));
  assert.equal(parts.length, 13);
});
