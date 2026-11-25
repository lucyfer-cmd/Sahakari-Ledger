// Business rules in one place so they are easy to explain and change.
module.exports = Object.freeze({
  MAX_LOAN_MULTIPLE: 5,          // a loan may be at most 5 times the member's savings balance
  MIN_TERM_MONTHS: 3,
  MAX_TERM_MONTHS: 60,
  MIN_LOAN_PAISA: 100000,        // Rs 1,000
  MAX_AMOUNT_PAISA: 100000000000, // Rs 1,000,000,000 sanity limit for one transaction
  REMINDER_DAYS: 3,              // remind members this many days before an instalment is due
  DEFAULT_RATES: { savings: 4, loan: 12 }, // used by the seed script (percent per year)
});
