import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { await login(form.email, form.password); navigate(location.state?.from?.pathname || '/', { replace: true }); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit}>
        <div><h1>Sign in</h1><p className="muted">Use the email and password of your cooperative account.</p></div>
        <ErrorBox error={error} />
        <Field label="Email"><input type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password"><input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <p className="muted small"><Link to="/forgot-password">Forgot password?</Link> &nbsp;|&nbsp; <Link to="/register">Create a member account</Link></p>
      </form>
    </AuthShell>
  );
}
