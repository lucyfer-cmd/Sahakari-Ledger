import { passwordChecks } from '../lib/password.js';

export default function PasswordChecklist({ value }) {
  return <ul className="checklist" aria-label="Password rules">{passwordChecks(value).map((c) => <li key={c.text} className={c.ok ? 'ok' : ''}>{c.text}</li>)}</ul>;
}
