import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import { useToast } from '../components/Toast.jsx';
import { ErrorBox, Field, PageHead } from '../components/ui.jsx';

export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', again: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError(null);
    if (form.newPassword !== form.again) { setError({ message: 'The two new passwords do not match' }); return; }
    try { await changePassword(form.currentPassword, form.newPassword); toast.success('Password changed. Other devices were signed out.'); setForm({ currentPassword: '', newPassword: '', again: '' }); }
    catch (err) { setError(err); }
  };
  return (
    <div style={{ maxWidth: 520 }}>
      <PageHead title="Change password" subtitle="Choose a strong password that you do not use anywhere else." />
      {user.mustChangePassword && <div className="alert warn">Your account uses a temporary password. Choose a new one to continue.</div>}
      <form className="card grid" onSubmit={submit}>
        <ErrorBox error={error} />
        <Field label="Current password"><input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} /></Field>
        <Field label="New password"><input type="password" autoComplete="new-password" required value={form.newPassword} onChange={set('newPassword')} /><PasswordChecklist value={form.newPassword} /></Field>
        <Field label="Confirm new password"><input type="password" autoComplete="new-password" required value={form.again} onChange={set('again')} /></Field>
        <div><button className="btn">Change password</button></div>
      </form>
    </div>
  );
}
