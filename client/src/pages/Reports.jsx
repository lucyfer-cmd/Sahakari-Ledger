import { useState } from 'react';
import { Link } from 'react-router-dom';
import { download } from '../api/http.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import { Empty, LoadError, Loading, Money, PageHead, Stat } from '../components/ui.jsx';
import { money } from '../lib/format.js';

export default function Reports() {
  const { can } = useAuth();
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const summary = useFetch('/reports/summary');
  const monthly = useFetch(`/reports/monthly?month=${month}`);
  const defaulters = useFetch('/reports/defaulters');
  const dl = (path, name) => download(path, name).catch((e) => toast.error(e.message));
  const s = summary.data?.summary;

  return (
    <>
      <PageHead title="Reports" subtitle="Summaries for the committee. Downloads are recorded in the audit log." />
      <LoadError error={summary.error} retry={summary.reload} />
      {summary.loading && !s ? <Loading /> : s && (
        <div className="grid cols-4">
          <Stat label="Members" value={s.activeMembers} sub={`${s.savingsAccounts} accounts`} /><Stat label="Total savings" value={money(s.totalSavingsPaisa)} />
          <Stat label="Loans to collect" value={money(s.loanReceivablePaisa)} sub={Object.entries(s.loansByStatus).map(([k, v]) => `${v} ${k}`).join(', ') || 'no loans'} />
          <Stat label="Overdue" value={money(s.overduePaisa)} tone={s.overdueInstallments ? 'warn' : 'good'} sub={`${s.overdueInstallments} instalment(s)`} />
        </div>
      )}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="card-head"><h2>Monthly summary</h2>
          <div className="actions"><input type="month" aria-label="Month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            <button className="btn secondary sm" onClick={() => dl(`/reports/monthly?month=${month}&format=pdf`, `monthly-${month}.pdf`)}>PDF</button>
            {can('report:export') && <button className="btn secondary sm" onClick={() => dl(`/reports/export/monthly?month=${month}`, `monthly-${month}.csv`)}>CSV</button>}</div></div>
        <LoadError error={monthly.error} retry={monthly.reload} />
        {monthly.data && <div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th className="num">Entries</th><th className="num">Total</th></tr></thead>
          <tbody>{monthly.data.report.rows.map((r) => <tr key={r.type}><td>{r.label}</td><td className="num">{r.count}</td><td className="num"><Money paisa={r.totalPaisa} /></td></tr>)}</tbody></table></div>}
      </div>
      <div className="card">
        <div className="card-head"><h2>Overdue loans (defaulter list)</h2>{can('report:export') && <button className="btn secondary sm" onClick={() => dl('/reports/export/defaulters', 'defaulters.csv')}>CSV</button>}</div>
        <LoadError error={defaulters.error} retry={defaulters.reload} />
        {defaulters.data && (defaulters.data.defaulters.length === 0 ? <Empty>No overdue instalments. Well done.</Empty> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Member</th><th>Phone</th><th>Loan</th><th className="num">Instalment</th><th className="num">Days late</th><th className="num">Unpaid</th></tr></thead>
            <tbody>{defaulters.data.defaulters.map((d, i) => <tr key={i}><td><strong>{d.memberName}</strong> <span className="muted small mono">{d.membershipNo}</span></td><td>{d.phone}</td><td><Link className="mono" to={`/loans/${d.loanId}`}>{d.loanNo}</Link></td><td className="num">{d.installmentNo}</td><td className="num neg">{d.daysOverdue}</td><td className="num"><Money paisa={d.unpaidPaisa} /></td></tr>)}</tbody></table></div>
        ))}
      </div>
      {can('report:export') && (
        <div className="card"><div className="card-head"><h2>Data exports</h2></div>
          <div className="actions"><button className="btn secondary" onClick={() => dl('/reports/export/members', 'members.csv')}>Members (CSV)</button><button className="btn secondary" onClick={() => dl('/reports/export/ledger', 'ledger.csv')}>Full ledger (CSV)</button></div></div>
      )}
    </>
  );
}
