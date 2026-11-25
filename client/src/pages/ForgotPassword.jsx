import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/http.js';
import AuthShell from '../components/AuthShell.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try { setMessage((await api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false })).message); } catch (err) { setError(err); }
  };
  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit}>
        <div><h1>Reset your password</h1><p className="muted">Enter your email and we will send a link that is valid for 30 minutes.</p></div>
        <ErrorBox error={error} />
        {message ? <div className="alert success">{message}</div> : (<>
          <Field label="Email"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn">Send reset link</button>
        </>)}
        <p className="muted small"><Link to="/login">Back to sign in</Link></p>
      </form>
    </AuthShell>
  );
}
