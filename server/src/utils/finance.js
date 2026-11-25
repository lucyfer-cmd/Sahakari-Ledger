// Money helpers. All money is stored as integer paisa (1 rupee = 100 paisa) to avoid floating-point errors.
const toPaisa = (rupees) => {
  const n = Number(rupees);
  if (!Number.isFinite(n)) throw new Error('Invalid amount');
  return Math.round(n * 100);
};
const fromPaisa = (paisa) => paisa / 100;

const startOfDayUTC = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const previousMonthKey = (d = new Date()) => monthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));

/** Same day next month; if the month is shorter the last day is used (31 Jan + 1 month = 28/29 Feb). */
function addMonthsUTC(date, n) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + n;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

/** Equal monthly instalment for a reducing-balance loan: EMI = P*r*(1+r)^n / ((1+r)^n - 1). */
function emiFor(principalPaisa, annualRatePct, termMonths) {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.round(principalPaisa / termMonths);
  const f = Math.pow(1 + r, termMonths);
  return Math.round((principalPaisa * r * f) / (f - 1));
}

/**
 * Builds the full repayment schedule. Interest each month = outstanding balance * monthly rate.
 * The last instalment clears whatever is left, so rounding never leaves a few paisa unpaid.
 */
function buildSchedule({ principalPaisa, annualRatePct, termMonths, startDate }) {
  const r = annualRatePct / 100 / 12;
  const emiPaisa = emiFor(principalPaisa, annualRatePct, termMonths);
  let balance = principalPaisa;
  const rows = [];
  for (let i = 1; i <= termMonths; i += 1) {
    const interest = Math.round(balance * r);
    let principal = emiPaisa - interest;
    if (i === termMonths || principal > balance) principal = balance;
    rows.push({ no: i, dueDate: addMonthsUTC(startDate, i), principalDuePaisa: principal, interestDuePaisa: interest });
    balance -= principal;
  }
  const totalInterestPaisa = rows.reduce((s, x) => s + x.interestDuePaisa, 0);
  return { emiPaisa, rows, totalInterestPaisa, totalPayablePaisa: principalPaisa + totalInterestPaisa };
}

module.exports = { toPaisa, fromPaisa, startOfDayUTC, monthKey, previousMonthKey, addMonthsUTC, emiFor, buildSchedule };
