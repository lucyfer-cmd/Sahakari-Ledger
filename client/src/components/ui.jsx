import { badgeClass, label, money } from '../lib/format.js';
import { useDateMode } from '../lib/dateMode.jsx';
import { dateAD, dateBS } from '../lib/format.js';

export const Badge = ({ value, tone }) => <span className={`badge ${tone || badgeClass(value)}`}>{label(value)}</span>;

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div className="grow"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export const Stat = ({ label: l, value, sub, tone }) => (
  <div className={`stat ${tone || ''}`}><div className="label">{l}</div><div className="value">{value}</div>{sub && <div className="sub">{sub}</div>}</div>
);

export const Money = ({ paisa, signed }) => {
  const n = Number(paisa || 0);
  if (!signed) return <span>{money(n)}</span>;
  return <span className={n < 0 ? 'neg' : n > 0 ? 'pos' : ''}>{n > 0 ? '+' : n < 0 ? '-' : ''}{money(Math.abs(n))}</span>;
};

/** Shows a date as AD, BS (Bikram Sambat) or both, following the choice in the top bar. */
export function DateText({ value }) {
  const { mode } = useDateMode();
  if (!value) return <span className="muted">-</span>;
  if (mode === 'ad') return <span className="nowrap">{dateAD(value)}</span>;
  if (mode === 'bs') return <span className="nowrap">{dateBS(value)} BS</span>;
  return <span className="nowrap">{dateAD(value)} <span className="muted small">({dateBS(value)} BS)</span></span>;
}

export function Pager({ page, pages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="pager">
      <span>{total} record{total === 1 ? '' : 's'}  |  page {page} of {pages}</span>
      <span className="actions">
        <button className="btn secondary sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn secondary sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    </div>
  );
}

export const Loading = () => <div className="center muted">Loading...</div>;
export const Empty = ({ children }) => <div className="empty">{children}</div>;

export function Field({ label: l, hint, children, className = '' }) {
  return <label className={`field ${className}`}>{l}{children}{hint && <span className="hint">{hint}</span>}</label>;
}

/** Shows what went wrong, including field-by-field messages from the API. */
export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="alert error" role="alert">
      <strong>{error.message}</strong>
      {error.details?.length > 0 && <ul>{error.details.map((d, i) => <li key={i}>{d.message}</li>)}</ul>}
    </div>
  );
}

export const LoadError = ({ error, retry }) => error && (
  <div className="alert error">{error.message} {retry && <button className="btn sm secondary" onClick={retry}>Try again</button>}</div>
);
