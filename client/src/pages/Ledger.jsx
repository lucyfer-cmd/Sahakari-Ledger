import { useState } from 'react';
import { api, download } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import { Badge, DateText, Empty, LoadError, Loading, Money, PageHead, Pager } from '../components/ui.jsx';
import { dateTime, label } from '../lib/format.js';

const TYPES = ['deposit', 'withdrawal', 'interest', 'loan_disbursement', 'loan_repayment', 'reversal'];
const REASONS = {
  hash_mismatch: 'The stored hash does not match the entry. The entry was changed after it was written.',
  broken_link: 'The entry does not point to the one before it. The chain is broken here.',
  sequence_gap: 'An entry is missing from the sequence.',
  balance_mismatch: 'The running balance does not follow from the entries.',
  checkpoint_mismatch: 'History before a saved checkpoint was rewritten.',
  entries_missing: 'Entries covered by a saved checkpoint are gone.',
  account_balance_mismatch: 'An account balance was changed without a ledger entry.',
};

function VerifyCard({ onChecked }) {
  const { can } = useAuth();
  const toast = useToast();
  const [result, setResult] = useState(null); const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const r = await api('/ledger/verify', { method: 'POST' }); setResult(r); onChecked(); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card">
      <div className="card-head"><div><h2 style={{ marginBottom: '.2rem' }}>Integrity check</h2><span className="muted small">Re-computes every hash from the first entry to prove nothing was changed, removed or re-ordered.</span></div>
        {can('ledger:verify') ? <button className="btn" onClick={run} disabled={busy}>{busy ? 'Checking...' : 'Verify integrity now'}</button> : <span className="muted small">Only auditors can run the check.</span>}</div>
      {result && (result.ok ? (
        <div className="alert success" style={{ marginBottom: 0 }}><strong>Chain intact.</strong> All {result.entriesChecked} entries and {result.checkpointsChecked} checkpoint(s) match. Checked in {result.durationMs} ms at {dateTime(result.checkedAt)}.</div>
      ) : (
        <div className="alert error" style={{ marginBottom: 0 }}>
          <strong>Problem found{result.firstBadSeq ? ` at entry #${result.firstBadSeq}` : ''}.</strong> Entries from this point cannot be trusted.
          <ul>{result.problems.map((p, i) => <li key={i}>{p.seq ? `#${p.seq}: ` : ''}{REASONS[p.reason] || p.reason} <span className="muted">({p.detail})</span></li>)}</ul>
        </div>
      ))}
    </div>
  );
}

function Checkpoints() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, reload } = useFetch('/ledger/checkpoints');
  const save = async () => { try { const r = await api('/ledger/checkpoints', { method: 'POST' }); toast.success(r.created ? `Checkpoint saved at entry #${r.checkpoint.upToSeq}` : 'A checkpoint already exists for the latest entry'); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <div className="card">
      <div className="card-head"><div><h2 style={{ marginBottom: '.2rem' }}>Checkpoints</h2><span className="muted small">A saved copy of the hash at a point in time. Rewriting history later would no longer match it.</span></div>
        {can('ledger:verify') && <button className="btn secondary" onClick={save}>Save checkpoint</button>}</div>
      {!data || data.checkpoints.length === 0 ? <Empty>No checkpoints yet.</Empty> : (
        <div className="table-wrap"><table className="table"><thead><tr><th>Up to entry</th><th>Hash</th><th>Saved</th><th>By</th></tr></thead>
          <tbody>{data.checkpoints.slice(0, 5).map((c) => <tr key={c.id}><td className="mono">#{c.upToSeq}</td><td className="mono">{c.hash.slice(0, 16)}...</td><td>{dateTime(c.createdAt)}</td><td>{c.createdBy ? 'Auditor' : 'System (daily job)'}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

export default function Ledger() {
  const { can } = useAuth();
  const toast = useToast();
  const [type, setType] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page, limit: 20, ...(type ? { type } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  const { data, loading, error, reload } = useFetch(`/ledger?${qs}`);

  return (
    <>
      <PageHead title="Ledger" subtitle="Every money movement, in order. Entries are never edited or deleted; mistakes are cancelled by a new opposite entry.">
        {can('report:export') && <button className="btn secondary" onClick={() => download('/reports/export/ledger', 'ledger.csv').catch((e) => toast.error(e.message))}>Export CSV</button>}
      </PageHead>
      <VerifyCard onChecked={reload} />
      <div style={{ marginTop: '1rem' }}><Checkpoints /></div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-head"><h2>Entries</h2>
          <div className="actions">
            <select style={{ width: 170 }} aria-label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">All types</option>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
            <input type="date" aria-label="From" style={{ width: 150 }} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <input type="date" aria-label="To" style={{ width: 150 }} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
        </div>
        <LoadError error={error} retry={reload} />
        {loading && !data ? <Loading /> : data && (
          <>
            <div className="table-wrap"><table className="table">
              <thead><tr><th className="num">#</th><th>Date</th><th>Type</th><th>Account</th><th className="num">Amount</th><th>Note</th><th>Hash</th></tr></thead>
              <tbody>{data.entries.map((e) => (
                <tr key={e.id}><td className="num mono">{e.seq}</td><td><DateText value={e.createdAt} /></td><td><Badge value={e.type} tone={e.type === 'reversal' ? 'blue' : undefined} /></td>
                  <td className="mono">{e.account?.accountNo || <span className="muted">cash</span>}</td><td className="num">{e.deltaPaisa !== 0 ? <Money paisa={e.deltaPaisa} signed /> : <Money paisa={e.amountPaisa} />}</td>
                  <td className="muted">{e.memo}</td><td className="mono muted" title={e.hash}>{e.hash.slice(0, 10)}</td></tr>))}</tbody>
            </table>{data.entries.length === 0 && <Empty>No entries match.</Empty>}</div>
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
          </>
        )}
      </div>
    </>
  );
}
