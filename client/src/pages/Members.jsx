import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { useToast } from '../components/Toast.jsx';
import { Badge, DateText, Empty, LoadError, Loading, PageHead, Pager } from '../components/ui.jsx';
import MemberForm from './MemberForm.jsx';

export default function Members() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(''); const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(params.get('new') === '1' && can('member:create'));

  useEffect(() => { const t = setTimeout(() => { setDebounced(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const qs = new URLSearchParams({ page, limit: 15, ...(debounced ? { q: debounced } : {}), ...(status ? { status } : {}) }).toString();
  const { data, loading, error, reload } = useFetch(`/members?${qs}`);

  return (
    <>
      <PageHead title="Members" subtitle="Everyone registered with the cooperative.">
        {can('member:create') && <button className="btn" onClick={() => setShowForm(true)}>Register a member</button>}
      </PageHead>
      <div className="toolbar">
        <input className="grow" type="search" placeholder="Search by name, membership number or phone" aria-label="Search members" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ width: 160 }} aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option>
        </select>
      </div>
      <LoadError error={error} retry={reload} />
      {loading && !data ? <Loading /> : data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Membership no.</th><th>Name</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.id} className="click" tabIndex={0} onClick={() => navigate(`/members/${m.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/members/${m.id}`)}>
                    <td className="mono">{m.membershipNo}</td><td><strong>{m.fullName}</strong></td><td>{m.phone}</td><td><Badge value={m.status} /></td><td><DateText value={m.joinedAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.members.length === 0 && <Empty>No members match your search.</Empty>}
          </div>
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      {showForm && <MemberForm onClose={() => { setShowForm(false); if (params.get('new')) setParams({}); }}
        onSaved={(m) => { setShowForm(false); toast.success(`${m.fullName} registered as ${m.membershipNo}`); navigate(`/members/${m.id}`); }} />}
    </>
  );
}
