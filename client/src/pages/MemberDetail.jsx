import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { Badge, DateText, Empty, ErrorBox, LoadError, Loading, Money, PageHead } from '../components/ui.jsx';
import MemberForm from './MemberForm.jsx';

export default function MemberDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(`/members/${id}`);
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [err, setErr] = useState(null);

  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  const { member: m, accounts, loans, login } = data;
  const run = async (fn, okMsg) => { setErr(null); try { await fn(); toast.success(okMsg); setConfirm(null); reload(); } catch (e) { setErr(e); } };
  const setStatus = (status) => run(() => api(`/members/${id}`, { method: 'PATCH', body: { status } }), `Member is now ${status}`);

  return (
    <>
      <PageHead title={m.fullName} subtitle={<><span className="mono">{m.membershipNo}</span> &nbsp; <Badge value={m.status} /></>}>
        {can('member:update') && <button className="btn secondary" onClick={() => setEdit(true)}>Edit details</button>}
        {can('account:open') && m.status === 'active' && <button className="btn" onClick={() => setConfirm('open')}>Open savings account</button>}
        {can('user:update-status') && m.status === 'active' && <button className="btn danger" onClick={() => setConfirm('suspend')}>Suspend</button>}
        {can('user:update-status') && m.status !== 'active' && <button className="btn success" onClick={() => setConfirm('activate')}>Reactivate</button>}
      </PageHead>
      <div className="grid cols-2">
        <div className="card">
          <div className="card-head"><h2>Profile</h2></div>
          <dl className="kv">
            <dt>Phone</dt><dd>{m.phone}</dd><dt>Email</dt><dd>{m.email || <span className="muted">-</span>}</dd>
            <dt>Date of birth</dt><dd>{m.dob ? <DateText value={m.dob} /> : <span className="muted">-</span>}</dd>
            <dt>Gender</dt><dd className="nowrap" style={{ textTransform: 'capitalize' }}>{m.gender || '-'}</dd>
            <dt>Address</dt><dd>{[m.address?.ward && `Ward ${m.address.ward}`, m.address?.municipality, m.address?.district].filter(Boolean).join(', ') || '-'}</dd>
            <dt>Member since</dt><dd><DateText value={m.joinedAt} /></dd>
          </dl>
        </div>
        <div className="card">
          <div className="card-head"><h2>Nominee and login</h2></div>
          <dl className="kv">
            <dt>Nominee</dt><dd>{m.nominee?.name ? `${m.nominee.name}${m.nominee.relation ? ` (${m.nominee.relation})` : ''}` : '-'}</dd>
            <dt>Nominee phone</dt><dd>{m.nominee?.phone || '-'}</dd>
            <dt>Online login</dt><dd>{login ? <>{login.email} <Badge value={login.status} /></> : <span className="muted">Not registered</span>}</dd>
          </dl>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Savings accounts</h2></div>
        {accounts.length === 0 ? <Empty>No savings account yet.</Empty> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Account</th><th className="num">Balance</th><th>Status</th><th>Opened</th></tr></thead><tbody>
            {accounts.map((a) => <tr key={a.id}><td><Link className="mono" to={`/accounts/${a.id}`}>{a.accountNo}</Link></td><td className="num"><Money paisa={a.balancePaisa} /></td><td><Badge value={a.status} /></td><td><DateText value={a.openedAt} /></td></tr>)}
          </tbody></table></div>
        )}
      </div>
      <div className="card">
        <div className="card-head"><h2>Loans</h2></div>
        {loans.length === 0 ? <Empty>No loans.</Empty> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Loan</th><th className="num">Amount</th><th>Term</th><th>Risk</th><th>Status</th><th>Applied</th></tr></thead><tbody>
            {loans.map((l) => <tr key={l.id}><td><Link className="mono" to={`/loans/${l.id}`}>{l.loanNo}</Link></td><td className="num"><Money paisa={l.principalPaisa} /></td><td>{l.termMonths} months</td><td><Badge value={l.riskBand} /> {l.riskScore}</td><td><Badge value={l.status} /></td><td><DateText value={l.appliedAt} /></td></tr>)}
          </tbody></table></div>
        )}
      </div>
      {edit && <MemberForm member={m} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); toast.success('Member updated'); reload(); }} />}
      {confirm && (
        <Modal small title={{ open: 'Open a savings account', suspend: 'Suspend member', activate: 'Reactivate member' }[confirm]} onClose={() => setConfirm(null)}
          footer={<><button className="btn secondary" onClick={() => setConfirm(null)}>Cancel</button>
            <button className={`btn ${confirm === 'suspend' ? 'danger' : ''}`} onClick={() => (confirm === 'open' ? run(() => api('/accounts', { method: 'POST', body: { memberId: id } }), 'Savings account opened') : setStatus(confirm === 'suspend' ? 'suspended' : 'active'))}>Confirm</button></>}>
          <ErrorBox error={err} />
          <p style={{ margin: 0 }}>{confirm === 'open' ? `Open a new savings account for ${m.fullName}?` : confirm === 'suspend' ? `${m.fullName} will no longer be able to open accounts or take loans.` : `${m.fullName} will be active again.`}</p>
        </Modal>
      )}
    </>
  );
}
