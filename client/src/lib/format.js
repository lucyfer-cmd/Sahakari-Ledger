import NepaliDate from 'nepali-date-converter';

export const money = (paisa) =>
  `Rs ${(Number(paisa || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AD = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dateAD = (d) => (d ? AD(d) : '');
export function dateBS(d) {
  if (!d) return '';
  try { return new NepaliDate(new Date(d)).format('YYYY-MM-DD'); } catch { return ''; }
}
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export const isoDate = (d) => new Date(d).toISOString().slice(0, 10);

const GOOD = new Set(['active', 'paid', 'closed', 'success', 'disbursed', 'low', 'deposit', 'interest']);
const BAD = new Set(['suspended', 'rejected', 'overdue', 'failure', 'high', 'withdrawal']);
const WARN = new Set(['pending', 'partial', 'applied', 'medium', 'approved']);
export const badgeClass = (s) => (GOOD.has(s) ? 'green' : BAD.has(s) ? 'red' : WARN.has(s) ? 'amber' : 'blue');
export const label = (s) => String(s || '').replace(/_/g, ' ');

/** Monthly payment for a reducing-balance loan, used only for the preview on the apply form. */
export function emiPreview(principalRupees, annualPct, months) {
  const r = annualPct / 100 / 12;
  if (!principalRupees || !months) return 0;
  if (r === 0) return principalRupees / months;
  const f = (1 + r) ** months;
  return (principalRupees * r * f) / (f - 1);
}
