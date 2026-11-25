process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { toPaisa, emiFor, buildSchedule, addMonthsUTC, monthKey, previousMonthKey } = require('../src/utils/finance');
const { toCsv } = require('../src/utils/csv');

test('rupees convert to paisa without floating-point drift', () => {
  assert.equal(toPaisa(0.1 + 0.2), 30);
  assert.equal(toPaisa(1234.56), 123456);
  assert.equal(toPaisa('50'), 5000);
});

test('EMI matches the hand-checked value: Rs 100,000 at 12% for 12 months = Rs 8,884.88', () => {
  assert.equal(emiFor(10000000, 12, 12), 888488);
});

test('EMI with zero interest is the principal divided by the months', () => {
  assert.equal(emiFor(1200000, 0, 12), 100000);
});

test('schedule: principal adds up exactly, interest falls over time, first month interest is Rs 1,000', () => {
  const s = buildSchedule({ principalPaisa: 10000000, annualRatePct: 12, termMonths: 12, startDate: new Date(Date.UTC(2026, 0, 15)) });
  assert.equal(s.rows.length, 12);
  assert.equal(s.rows.reduce((t, r) => t + r.principalDuePaisa, 0), 10000000);
  assert.equal(s.rows[0].interestDuePaisa, 100000);
  assert.equal(s.rows[0].principalDuePaisa, 788488);
  for (let i = 1; i < 12; i += 1) assert.ok(s.rows[i].interestDuePaisa < s.rows[i - 1].interestDuePaisa);
  assert.ok(Math.abs(s.rows[11].principalDuePaisa + s.rows[11].interestDuePaisa - s.emiPaisa) < 20); // the last instalment is within a few paisa of the EMI
  assert.equal(s.totalPayablePaisa, 10000000 + s.totalInterestPaisa);
  assert.equal(s.rows[0].dueDate.toISOString().slice(0, 10), '2026-02-15');
});

test('schedule always clears the loan, for many amounts, rates and terms', () => {
  for (const p of [123457, 5000000, 99999999]) for (const r of [0, 7.5, 12, 18]) for (const n of [3, 7, 24, 60]) {
    const s = buildSchedule({ principalPaisa: p, annualRatePct: r, termMonths: n, startDate: new Date(Date.UTC(2026, 0, 31)) });
    assert.equal(s.rows.reduce((t, x) => t + x.principalDuePaisa, 0), p, `${p} ${r}% ${n}m`);
    assert.ok(s.rows.every((x) => x.principalDuePaisa >= 0 && x.interestDuePaisa >= 0));
  }
});

test('month-end dates are clamped (31 Jan + 1 month = 28 Feb)', () => {
  assert.equal(addMonthsUTC(new Date(Date.UTC(2026, 0, 31)), 1).toISOString().slice(0, 10), '2026-02-28');
  assert.equal(addMonthsUTC(new Date(Date.UTC(2026, 10, 30)), 3).toISOString().slice(0, 10), '2027-02-28');
});

test('month keys', () => {
  assert.equal(monthKey(new Date(Date.UTC(2026, 10, 5))), '2026-11');
  assert.equal(previousMonthKey(new Date(Date.UTC(2026, 0, 5))), '2025-12');
});

test('CSV quotes commas and quotes, and blocks spreadsheet formulas', () => {
  const csv = toCsv([{ label: 'Name', value: 'n' }, { label: 'Note', value: 'x' }], [{ n: 'Rai, Sita', x: '=SUM(A1)' }, { n: 'Say "hi"', x: -5 }]);
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Name,Note');
  assert.equal(lines[1], '"Rai, Sita",\'=SUM(A1)');
  assert.equal(lines[2], '"Say ""hi""",-5');
});
