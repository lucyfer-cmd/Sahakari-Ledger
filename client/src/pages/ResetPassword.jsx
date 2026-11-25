import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/http.js';
import AuthShell from '../components/AuthShell.jsx';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const [pw, setPw] = useState(''); const [again, setAgain] = useState('');
  const [message, setMessage] = useState(''); const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    if (pw !== again) { setError({ message: 'The two passwords do not match' }); return; }
    try { setMessage((await api('/auth/reset-password', { method: 'POST', body: { token: params.get('token') || '', newPassword: pw }, auth: false })).message); }
    catch (err) { setError(err); }
  };
  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit}>
        <div><h1>Choose a new password</h1><p className="muted">This link works once. After the change, you are signed out everywhere.</p></div>
        <ErrorBox error={error} />
        {message ? <><div className="alert success">{message}</div><Link className="btn" to="/login">Sign in</Link></> : (<>
          <Field label="New password"><input type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /><PasswordChecklist value={pw} /></Field>
          <Field label="Confirm new password"><input type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
          <button className="btn">Update password</button>
        </>)}
      </form>
    </AuthShell>
  );
}
