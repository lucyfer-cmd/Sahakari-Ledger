import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import Modal from '../components/Modal.jsx';
import { Badge, DateText, ErrorBox, Field, LoadError, Loading, Money, PageHead, Stat } from '../components/ui.jsx';
import { money } from '../lib/format.js';

function ActionModal({ kind, loan, due, onClose, onDone }) {
  const [text, setText] = useState(''); const [amount, setAmount] = useState(kind === 'repay' && due ? String(due / 100) : '');
  const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const cfg = {
    approve: { title: 'Approve loan', btn: 'Approve', cls: 'success', path: 'approve', body: () => ({ note: text }) },
    reject: { title: 'Reject loan', btn: 'Reject', cls: 'danger', path: 'reject', body: () => ({ note: text }) },
    disburse: { title: 'Disburse loan', btn: 'Disburse now', cls: '', path: 'disburse', body: () => undefined },
    repay: { title: 'Collect a payment', btn: 'Record payment', cls: 'success', path: 'repay', body: () => ({ amount: Number(amount), memo: text }) },
  }[kind];
  const submit = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { await api(`/loans/${loan.id}/${cfg.path}`, { method: 'POST', body: cfg.body() }); onDone(cfg.title); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <Modal small title={cfg.title} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Cancel</button><button form="loan-form" className={`btn ${cfg.cls}`} disabled={busy}>{busy ? 'Working...' : cfg.btn}</button></>}>
      <form id="loan-form" className="grid" onSubmit={submit}>
        <ErrorBox error={error} />
        {kind === 'approve' && <><p style={{ margin: 0 }}>Approving fixes the interest rate for this loan at today's rate. Money is paid out in the next step (disburse).</p><Field label="Note (optional)"><input maxLength={300} value={text} onChange={(e) => setText(e.target.value)} /></Field></>}
        {kind === 'reject' && <Field label="Reason (shown to the member)"><input required minLength={3} maxLength={300} autoFocus value={text} onChange={(e) => setText(e.target.value)} /></Field>}
        {kind === 'disburse' && <p style={{ margin: 0 }}>{money(loan.principalPaisa)} will be added to the member's savings account, the repayment schedule will be created, and the payment will be recorded in the ledger.</p>}
        {kind === 'repay' && <><p className="muted" style={{ margin: 0 }}>The payment clears the oldest unpaid instalments first. Still due: <strong>{money(due)}</strong>.</p>
          <Field label="Amount received (Rs)"><input type="number" min="0.01" step="0.01" required autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Note (optional)"><input maxLength={200} value={text} onChange={(e) => setText(e.target.value)} /></Field></>}
      </form>
    </Modal>
  );
}

export default function LoanDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(`/loans/${id}`);
  const [modal, setModal] = useState(null);
  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  const { loan, installments, remainingPaisa, previewEmiPaisa } = data;
  const paid = installments.filter((i) => i.status === 'paid').length;

  return (
    <>
      <PageHead title={`Loan ${loan.loanNo}`} subtitle={<>{can('member:read') ? <Link to={`/members/${loan.member.id}`}>{loan.member.fullName}</Link> : loan.member.fullName} <span className="mono muted">{loan.member.membershipNo}</span> &nbsp; <Badge value={loan.status} /></>}>
        {loan.status === 'applied' && can('loan:approve') && <><button className="btn success" onClick={() => setModal('approve')}>Approve</button><button className="btn danger" onClick={() => setModal('reject')}>Reject</button></>}
        {loan.status === 'approved' && can('loan:disburse') && <button className="btn" onClick={() => setModal('disburse')}>Disburse</button>}
        {loan.status === 'disbursed' && can('loan:collect') && <button className="btn success" onClick={() => setModal('repay')}>Collect payment</button>}
      </PageHead>
      {loan.status === 'rejected' && <div className="alert error"><strong>Not approved.</strong> {loan.reviewNote}</div>}
      <div className="grid cols-4">
        <Stat label="Loan amount" value={<Money paisa={loan.principalPaisa} />} sub={loan.purpose || 'No purpose given'} />
        <Stat label="Monthly instalment" value={previewEmiPaisa ? <Money paisa={previewEmiPaisa} /> : '-'} sub={loan.annualRatePct !== null ? `${loan.annualRatePct}% per year, ${loan.termMonths} months` : `${loan.termMonths} months (rate fixed at approval)`} />
        <Stat label="Still to pay" value={installments.length ? <Money paisa={remainingPaisa} /> : '-'} sub={installments.length ? `${paid} of ${installments.length} instalments paid` : 'Schedule is created at disbursement'} />
        <Stat label="Applied" value={<DateText value={loan.appliedAt} />} sub={`Paid into ${loan.account?.accountNo || 'savings account'}`} />
      </div>
      <div className="grid cols-2" style={{ marginTop: '1rem' }}>
        <div className="card">
          <div className="card-head"><h2>Risk score</h2></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '.6rem', marginBottom: '1rem' }}><span className={`score ${loan.riskBand}`}>{loan.riskScore}</span><span className="muted">out of 100</span><Badge value={loan.riskBand} /></div>
          {loan.riskBreakdown.map((f) => (
            <div key={f.key} style={{ marginBottom: '.7rem' }}>
              <div className="risk" style={{ marginBottom: '.2rem' }}><span>{f.label} <span className="muted small">(weight {f.weight})</span></span><span className="right small">{f.points} pts</span></div>
              <div className="bar" role="img" aria-label={`${f.label}: ${Math.round(f.value * 100)} percent`}><span style={{ width: `${Math.round(f.value * 100)}%` }} /></div>
            </div>
          ))}
          <p className="muted small" style={{ marginBottom: 0 }}>A transparent rule-based score from repayment history, savings, time as a member and anything overdue. It helps the decision; people decide.</p>
        </div>
        <div className="card">
          <div className="card-head"><h2>Decision</h2></div>
          <dl className="kv">
            <dt>Status</dt><dd><Badge value={loan.status} /></dd>
            <dt>Reviewed</dt><dd>{loan.reviewedAt ? <DateText value={loan.reviewedAt} /> : <span className="muted">Not yet</span>}</dd>
            <dt>Note</dt><dd>{loan.reviewNote || <span className="muted">-</span>}</dd>
            <dt>Disbursed</dt><dd>{loan.disbursedAt ? <DateText value={loan.disbursedAt} /> : <span className="muted">Not yet</span>}</dd>
          </dl>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>Repayment schedule</h2></div>
        {installments.length === 0 ? <p className="muted" style={{ margin: 0 }}>The schedule is created when the loan is disbursed.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>#</th><th>Due date</th><th className="num">Principal</th><th className="num">Interest</th><th className="num">Total</th><th className="num">Paid</th><th>Status</th></tr></thead>
            <tbody>{installments.map((i) => (
              <tr key={i.id}><td>{i.no}</td><td><DateText value={i.dueDate} /></td><td className="num"><Money paisa={i.principalDuePaisa} /></td><td className="num"><Money paisa={i.interestDuePaisa} /></td>
                <td className="num"><Money paisa={i.principalDuePaisa + i.interestDuePaisa} /></td><td className="num"><Money paisa={i.paidPaisa} /></td><td><Badge value={i.status} /></td></tr>))}</tbody>
          </table></div>
        )}
      </div>
      {modal && <ActionModal kind={modal} loan={loan} due={remainingPaisa} onClose={() => setModal(null)} onDone={(t) => { setModal(null); toast.success(`${t}: done`); reload(); }} />}
    </>
  );
}
