import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/http.js';
import AuthShell from '../components/AuthShell.jsx';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', membershipNo: '', password: '' });
  const [error, setError] = useState(null);
  const [done, setDone] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try { setDone((await api('/auth/register', { method: 'POST', body: form, auth: false })).message); } catch (err) { setError(err); }
  };
  return (
    <AuthShell>
      {done ? (
        <div className="auth-card"><h1>Almost done</h1><div className="alert success">{done}</div><Link className="btn secondary" to="/login">Back to sign in</Link></div>
      ) : (
        <form className="auth-card" onSubmit={submit}>
          <div><h1>Create a member account</h1><p className="muted">You must already be a cooperative member. Use the membership number and phone number the cooperative has on file.</p></div>
          <ErrorBox error={error} />
          <Field label="Full name"><input required value={form.fullName} onChange={set('fullName')} /></Field>
          <div className="form-grid">
            <Field label="Membership number"><input required placeholder="M-0001" value={form.membershipNo} onChange={set('membershipNo')} /></Field>
            <Field label="Phone"><input required inputMode="tel" value={form.phone} onChange={set('phone')} /></Field>
          </div>
          <Field label="Email"><input type="email" required autoComplete="username" value={form.email} onChange={set('email')} /></Field>
          <Field label="Password"><input type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} /><PasswordChecklist value={form.password} /></Field>
          <button className="btn">Register</button>
          <p className="muted small">After you register, cooperative staff must approve the account before you can sign in. Already registered? <Link to="/login">Sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
