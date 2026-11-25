import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, download } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { Badge, DateText, Empty, ErrorBox, Field, LoadError, Loading, Money, PageHead, Stat } from '../components/ui.jsx';

function MoneyModal({ kind, account, onClose, onDone }) {
  const [amount, setAmount] = useState(''); const [memo, setMemo] = useState('');
  const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { await api(`/accounts/${account.id}/${kind}`, { method: 'POST', body: { amount: Number(amount), memo } }); onDone(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <Modal small title={kind === 'deposit' ? 'Record a deposit' : 'Record a withdrawal'} onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button form="money-form" className={`btn ${kind === 'withdraw' ? 'danger' : 'success'}`} disabled={busy}>{busy ? 'Saving...' : kind === 'deposit' ? 'Record deposit' : 'Record withdrawal'}</button></>}>
      <form id="money-form" className="grid" onSubmit={submit}>
        <ErrorBox error={error} />
        <p className="muted" style={{ margin: 0 }}>Account {account.accountNo}. Current balance <strong><Money paisa={account.balancePaisa} /></strong>.</p>
        <Field label="Amount (Rs)"><input type="number" min="0.01" step="0.01" required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Note (optional)"><input maxLength={200} value={memo} onChange={(e) => setMemo(e.target.value)} /></Field>
        <p className="muted small" style={{ margin: 0 }}>The entry is added to the tamper-evident ledger and cannot be edited later, only reversed by an administrator.</p>
      </form>
    </Modal>
  );
}

function ReverseModal({ entry, onClose, onDone }) {
  const [reason, setReason] = useState(''); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { await api(`/ledger/${entry.id}/reverse`, { method: 'POST', body: { reason } }); onDone(); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <Modal small title={`Reverse entry #${entry.seq}`} onClose={onClose}
      footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button form="rev-form" className="btn danger" disabled={busy}>Reverse entry</button></>}>
      <form id="rev-form" className="grid" onSubmit={submit}>
        <ErrorBox error={error} />
        <p style={{ margin: 0 }}>A new opposite entry will be added. The original stays in the ledger.</p>
        <Field label="Reason"><input required minLength={3} maxLength={150} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}

export default function AccountDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [modal, setModal] = useState(null); const [reverse, setReverse] = useState(null);
  const acct = useFetch(`/accounts/${id}`);
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const st = useFetch(`/accounts/${id}/statement${qs ? `?${qs}` : ''}`);
  const refresh = () => { acct.reload(); st.reload(); };

  if (acct.loading && !acct.data) return <Loading />;
  if (acct.error) return <LoadError error={acct.error} retry={acct.reload} />;
  const a = acct.data.account;
  const pdf = () => download(`/accounts/${id}/statement?format=pdf${qs ? `&${qs}` : ''}`, `statement-${a.accountNo}.pdf`).catch((e) => toast.error(e.message));

  return (
    <>
      <PageHead title={`Account ${a.accountNo}`} subtitle={<>{can('member:read') ? <Link to={`/members/${a.member.id}`}>{a.member.fullName}</Link> : a.member.fullName} <span className="mono muted">{a.member.membershipNo}</span> &nbsp; <Badge value={a.status} /></>}>
        {can('transaction:deposit') && <button className="btn success" onClick={() => setModal('deposit')}>Deposit</button>}
        {can('transaction:withdraw') && <button className="btn danger" onClick={() => setModal('withdraw')}>Withdraw</button>}
        <button className="btn secondary" onClick={pdf}>Download PDF</button>
      </PageHead>
      <div className="grid cols-3"><Stat label="Current balance" value={<Money paisa={a.balancePaisa} />} /><Stat label="Opened" value={<DateText value={a.openedAt} />} /><Stat label="Entries in view" value={st.data ? st.data.entries.length : '-'} sub={st.data && qs ? 'for the chosen period' : 'all time'} /></div>
      <div className="card">
        <div className="card-head"><h2>Statement</h2>
          <div className="actions"><Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>
        </div>
        <LoadError error={st.error} retry={st.reload} />
        {st.loading && !st.data ? <Loading /> : st.data && (
          <>
            {qs && <p className="muted small" style={{ marginTop: 0 }}>Opening balance for this period: <strong><Money paisa={st.data.openingPaisa} /></strong></p>}
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Date</th><th className="num">#</th><th>Type</th><th>Note</th><th className="num">Amount</th><th className="num">Balance</th>{can('transaction:reverse') && <th />}</tr></thead>
              <tbody>{st.data.entries.map((e) => (
                <tr key={e.id}>
                  <td><DateText value={e.createdAt} /></td><td className="num mono">{e.seq}</td><td><Badge value={e.type} /></td>
                  <td className="muted">{e.memo}</td><td className="num"><Money paisa={e.deltaPaisa} signed /></td><td className="num"><Money paisa={e.balanceAfterPaisa} /></td>
                  {can('transaction:reverse') && <td className="right">{['deposit', 'withdrawal', 'interest'].includes(e.type) && <button className="btn ghost sm" onClick={() => setReverse(e)}>Reverse</button>}</td>}
                </tr>))}</tbody>
            </table>{st.data.entries.length === 0 && <Empty>No entries for this period.</Empty>}</div>
          </>
        )}
      </div>
      {modal && <MoneyModal kind={modal} account={a} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.success(modal === 'deposit' ? 'Deposit recorded' : 'Withdrawal recorded'); refresh(); }} />}
      {reverse && <ReverseModal entry={reverse} onClose={() => setReverse(null)} onDone={() => { setReverse(null); toast.success('Entry reversed'); refresh(); }} />}
    </>
  );
}
