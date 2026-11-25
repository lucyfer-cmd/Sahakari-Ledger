import { useState } from 'react';
import { useFetch } from '../hooks/useFetch.js';
import { Badge, Empty, LoadError, Loading, PageHead, Pager } from '../components/ui.jsx';
import { dateTime } from '../lib/format.js';

export default function Audit() {
  const [f, setF] = useState({ action: '', actor: '', outcome: '', from: '', to: '' }); const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page, limit: 25, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString();
  const { data, loading, error, reload } = useFetch(`/audit?${qs}`);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };
  return (
    <>
      <PageHead title="Audit log" subtitle="Who did what, and when. Logins, approvals, role changes, loans, ledger checks and exports are all recorded." />
      <div className="toolbar">
        <select style={{ width: 200 }} aria-label="Action" value={f.action} onChange={set('action')}><option value="">All actions</option>{(data?.actions || []).map((a) => <option key={a}>{a}</option>)}</select>
        <input style={{ width: 200 }} placeholder="Person (email)" aria-label="Person" value={f.actor} onChange={set('actor')} />
        <select style={{ width: 140 }} aria-label="Outcome" value={f.outcome} onChange={set('outcome')}><option value="">Any outcome</option><option value="success">Success</option><option value="failure">Failure</option></select>
        <input type="date" style={{ width: 150 }} aria-label="From" value={f.from} onChange={set('from')} /><input type="date" style={{ width: 150 }} aria-label="To" value={f.to} onChange={set('to')} />
      </div>
      <LoadError error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (
        <>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Time</th><th>Person</th><th>Action</th><th>Result</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>{data.logs.map((l) => (
              <tr key={l.id}><td className="nowrap">{dateTime(l.createdAt)}</td><td>{l.actorEmail || <span className="muted">system / anonymous</span>}</td><td className="mono">{l.action}</td><td><Badge value={l.outcome} /></td>
                <td>{l.meta && Object.keys(l.meta).length > 0 ? <details><summary className="small">View</summary><pre className="mono" style={{ margin: '.3rem 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.meta, null, 2)}</pre></details> : <span className="muted">-</span>}</td>
                <td className="mono muted">{l.ip}</td></tr>))}</tbody>
          </table>{data.logs.length === 0 && <Empty>No records match.</Empty>}</div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
