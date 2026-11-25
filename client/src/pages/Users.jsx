import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import PasswordChecklist from '../components/PasswordChecklist.jsx';
import { Badge, DateText, Empty, ErrorBox, Field, LoadError, Loading, PageHead } from '../components/ui.jsx';

const ROLES = ['admin', 'teller', 'member', 'auditor'];

function StaffModal({ onClose, onDone }) {
  const [f, setF] = useState({ fullName: '', email: '', phone: '', role: 'teller', temporaryPassword: '' });
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try { await api('/users', { method: 'POST', body: { ...f, phone: f.phone || undefined } }); onDone(); } catch (err) { setError(err); }
  };
  return (
    <Modal title="Create a staff account" onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button form="staff-form" className="btn">Create account</button></>}>
      <form id="staff-form" className="grid" onSubmit={submit}>
        <ErrorBox error={error} />
        <div className="form-grid">
          <Field label="Full name" className="full"><input required value={f.fullName} onChange={set('fullName')} /></Field>
          <Field label="Email"><input type="email" required value={f.email} onChange={set('email')} /></Field>
          <Field label="Role"><select value={f.role} onChange={set('role')}><option value="teller">Teller</option><option value="auditor">Auditor</option><option value="admin">Admin</option></select></Field>
          <Field label="Temporary password" className="full" hint="The person must change it the first time they sign in."><input type="text" required autoComplete="off" value={f.temporaryPassword} onChange={set('temporaryPassword')} /><PasswordChecklist value={f.temporaryPassword} /></Field>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { can, user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null); const [error, setError] = useState(null);
  const [status, setStatus] = useState(''); const [staff, setStaff] = useState(false);

  const load = useCallback(async () => {
    try { setError(null); setUsers((await api(`/users${status ? `?status=${status}` : ''}`)).users); } catch (e) { setError(e); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const act = async (path, body, okMsg) => { try { await api(path, { method: 'PATCH', body }); toast.success(okMsg); load(); } catch (e) { toast.error(e.message); } };
  return (
    <>
      <PageHead title="Users" subtitle="Login accounts. Roles and suspensions take effect immediately and are recorded in the audit log.">
        {can('user:create') && <button className="btn" onClick={() => setStaff(true)}>Create staff account</button>}
      </PageHead>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Status filter">{[['', 'All'], ['pending', 'Pending approval'], ['active', 'Active'], ['suspended', 'Suspended']].map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
      </div>
      <LoadError error={error} retry={load} />
      {!users && !error ? <Loading /> : users && (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}><td><strong>{u.fullName}</strong></td><td>{u.email}</td>
              <td>{can('user:update-role') && u.id !== me.id ? <select style={{ width: 120 }} aria-label={`Role of ${u.fullName}`} value={u.role} onChange={(e) => act(`/users/${u.id}/role`, { role: e.target.value }, 'Role updated')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select> : <Badge value={u.role} />}</td>
              <td><Badge value={u.status} /></td><td>{u.lastLoginAt ? <DateText value={u.lastLoginAt} /> : <span className="muted">Never</span>}</td>
              <td className="right nowrap">
                {u.status === 'pending' && can('user:approve-member') && <button className="btn success sm" onClick={() => act(`/users/${u.id}/approve`, undefined, 'Account approved')}>Approve</button>}{' '}
                {can('user:update-status') && u.id !== me.id && u.status === 'active' && <button className="btn secondary sm" onClick={() => act(`/users/${u.id}/status`, { status: 'suspended' }, 'Account suspended')}>Suspend</button>}
                {can('user:update-status') && u.id !== me.id && u.status === 'suspended' && <button className="btn secondary sm" onClick={() => act(`/users/${u.id}/status`, { status: 'active' }, 'Account reactivated')}>Reactivate</button>}
              </td></tr>))}</tbody>
        </table>{users.length === 0 && <Empty>No users match.</Empty>}</div>
      )}
      {staff && <StaffModal onClose={() => setStaff(false)} onDone={() => { setStaff(false); toast.success('Staff account created'); load(); }} />}
    </>
  );
}
