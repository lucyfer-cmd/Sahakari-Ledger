process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { computeRisk, maxLoanPaisa } = require('../src/services/risk.service');

test('a long-standing member with big savings and a clean record scores 100', () => {
  const r = computeRisk({ memberSinceMonths: 36, savingsBalancePaisa: 5000000, principalPaisa: 1000000, paidShare: 1, overdueCount: 0 });
  assert.equal(r.score, 100); assert.equal(r.band, 'low');
});

test('a brand-new member with no savings buffer is high risk', () => {
  const r = computeRisk({ memberSinceMonths: 0, savingsBalancePaisa: 0, principalPaisa: 1000000, paidShare: null, overdueCount: 0 });
  assert.equal(r.score, 41); // 0.6*35 + 0 + 0 + 20
  assert.equal(r.band, 'medium');
  const bad = computeRisk({ memberSinceMonths: 1, savingsBalancePaisa: 0, principalPaisa: 1000000, paidShare: 0.2, overdueCount: 2 });
  assert.equal(bad.band, 'high');
});

test('the factor points add up to the score and weights add up to 100', () => {
  const r = computeRisk({ memberSinceMonths: 10, savingsBalancePaisa: 300000, principalPaisa: 1000000, paidShare: 0.8, overdueCount: 1 });
  assert.equal(r.factors.reduce((s, f) => s + f.weight, 0), 100);
  assert.ok(Math.abs(r.factors.reduce((s, f) => s + f.points, 0) - r.score) <= 1);
});

test('loan limit is five times the savings', () => {
  assert.equal(maxLoanPaisa(200000), 1000000);
});
