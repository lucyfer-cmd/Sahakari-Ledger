import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import { Badge, DateText, Empty, ErrorBox, Field, LoadError, Loading, Money, PageHead, Pager } from '../components/ui.jsx';
import { emiPreview, money } from '../lib/format.js';

const MULTIPLE = 5;

function ApplyCard({ onApplied }) {
  const toast = useToast();
  const accounts = useFetch('/accounts/mine');
  const rates = useFetch('/rates');
  const [f, setF] = useState({ amount: '', termMonths: 12, purpose: '' });
  const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const balance = (accounts.data?.accounts || []).reduce((s, a) => s + a.balancePaisa, 0);
  const rate = rates.data?.current?.loan?.ratePct;
  const emi = useMemo(() => (rate !== undefined ? emiPreview(Number(f.amount), rate, Number(f.termMonths)) : 0), [f, rate]);

  const submit = async (e) => {
    e.preventDefault(); setError(null); setBusy(true);
    try { await api('/loans', { method: 'POST', body: { amount: Number(f.amount), termMonths: Number(f.termMonths), purpose: f.purpose } }); toast.success('Application sent. The cooperative will review it.'); setF({ amount: '', termMonths: 12, purpose: '' }); onApplied(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  };
  if (accounts.loading) return null;
  return (
    <div className="card">
      <div className="card-head"><h2>Apply for a loan</h2></div>
      <p className="muted" style={{ marginTop: 0 }}>You can borrow up to {MULTIPLE} times your savings: <strong>{money(balance * MULTIPLE)}</strong>.{rate !== undefined && <> Interest is {rate}% per year on the reducing balance.</>}</p>
      <form className="grid" onSubmit={submit}>
        <ErrorBox error={error} />
        <div className="form-grid">
          <Field label="Amount (Rs)"><input type="number" min="1000" step="0.01" required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Term (months)"><input type="number" min="3" max="60" required value={f.termMonths} onChange={(e) => setF({ ...f, termMonths: e.target.value })} /></Field>
          <Field label="Purpose" className="full"><input maxLength={200} placeholder="For example: shop stock, school fees" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
        </div>
        {emi > 0 && <div className="alert info" style={{ marginBottom: 0 }}>Estimated monthly instalment: <strong>{money(Math.round(emi * 100))}</strong> (final amounts are fixed when the loan is approved).</div>}
        <div><button className="btn" disabled={busy}>{busy ? 'Sending...' : 'Send application'}</button></div>
      </form>
    </div>
  );
}

export default function Loans() {
  const { can } = useAuth();
  const staff = can('loan:read');
  const navigate = useNavigate();
  const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const path = staff ? `/loans?page=${page}&limit=15${status ? `&status=${status}` : ''}` : '/loans/mine';
  const { data, loading, error, reload } = useFetch(path);

  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  const open = !staff && data.loans.some((l) => ['applied', 'approved', 'disbursed'].includes(l.status));
  return (
    <>
      <PageHead title={staff ? 'Loans' : 'My loans'} subtitle={staff ? 'Applications, active loans and repayments.' : 'Your loan applications and repayments.'}>
        {staff && <select style={{ width: 170 }} aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>{['applied', 'approved', 'disbursed', 'closed', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}</select>}
      </PageHead>
      {can('loan:apply') && !open && <ApplyCard onApplied={reload} />}
      <div style={{ marginTop: '1rem' }}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Loan</th>{staff && <th>Member</th>}<th className="num">Amount</th><th>Term</th><th>Risk</th><th>Status</th><th>Applied</th></tr></thead>
          <tbody>{data.loans.map((l) => (
            <tr key={l.id} className="click" tabIndex={0} onClick={() => navigate(`/loans/${l.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/loans/${l.id}`)}>
              <td className="mono">{l.loanNo}</td>{staff && <td><strong>{l.member?.fullName}</strong> <span className="muted small mono">{l.member?.membershipNo}</span></td>}
              <td className="num"><Money paisa={l.principalPaisa} /></td><td>{l.termMonths} months</td><td><Badge value={l.riskBand} /> <span className="small">{l.riskScore}</span></td><td><Badge value={l.status} /></td><td><DateText value={l.appliedAt} /></td>
            </tr>))}</tbody>
        </table>{data.loans.length === 0 && <Empty>No loans yet.</Empty>}</div>
        {staff && <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />}
      </div>
    </>
  );
}
