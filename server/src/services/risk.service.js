const { MAX_LOAN_MULTIPLE } = require('../config/business');

const WEIGHTS = { repayment: 35, savings: 25, tenure: 20, standing: 20 };

/**
 * Simple, explainable loan risk score from 0 (risky) to 100 (safe). Four factors, each between 0 and 1,
 * multiplied by its weight. This is a rule-based formula, not machine learning.
 *
 *  repayment: share of past instalments paid (a new borrower gets a neutral 0.6)
 *  savings:   savings balance divided by the loan amount (1 or more is the best)
 *  tenure:    months as a member out of 24
 *  standing:  1 if nothing is overdue, lower for every overdue instalment
 */
function computeRisk({ memberSinceMonths, savingsBalancePaisa, principalPaisa, paidShare, overdueCount }) {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const factors = [
    { key: 'repayment', label: 'Repayment history', weight: WEIGHTS.repayment, value: paidShare === null || paidShare === undefined ? 0.6 : clamp(paidShare) },
    { key: 'savings', label: 'Savings compared with the loan', weight: WEIGHTS.savings, value: clamp(savingsBalancePaisa / principalPaisa) },
    { key: 'tenure', label: 'Time as a member', weight: WEIGHTS.tenure, value: clamp(memberSinceMonths / 24) },
    { key: 'standing', label: 'Nothing overdue now', weight: WEIGHTS.standing, value: overdueCount === 0 ? 1 : clamp(1 - 0.5 * overdueCount) },
  ].map((f) => ({ ...f, points: Math.round(f.weight * f.value * 10) / 10 }));
  const score = Math.round(factors.reduce((s, f) => s + f.weight * f.value, 0));
  const band = score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high';
  return { score, band, factors };
}

const maxLoanPaisa = (savingsBalancePaisa) => savingsBalancePaisa * MAX_LOAN_MULTIPLE;

module.exports = { computeRisk, maxLoanPaisa, WEIGHTS };
