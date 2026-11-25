import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { Badge, DateText, Empty, LoadError, Loading, Money, PageHead, Stat } from '../components/ui.jsx';

export default function Accounts() {
  const { can } = useAuth();
  const staff = can('account:read');
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch(staff ? '/accounts' : '/accounts/mine');
  const [q, setQ] = useState('');
  const rows = useMemo(() => (data?.accounts || []).filter((a) => !q || `${a.accountNo} ${a.member?.fullName || ''} ${a.member?.membershipNo || ''}`.toLowerCase().includes(q.toLowerCase())), [data, q]);

  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  if (!staff) {
    return (
      <>
        <PageHead title="My accounts" subtitle="Your savings with the cooperative." />
        {rows.length === 0 ? <div className="card"><Empty>You do not have a savings account yet. Please visit the cooperative office.</Empty></div> : (
          <div className="grid cols-3">{rows.map((a) => <Link key={a.id} to={`/accounts/${a.id}`} style={{ textDecoration: 'none' }}><Stat label={`Savings ${a.accountNo}`} value={<Money paisa={a.balancePaisa} />} sub="View statement" /></Link>)}</div>
        )}
      </>
    );
  }
  return (
    <>
      <PageHead title="Savings accounts" subtitle="Open an account from a member's page." />
      <div className="toolbar"><input className="grow" type="search" aria-label="Search accounts" placeholder="Search by account number or member" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Account</th><th>Member</th><th className="num">Balance</th><th>Status</th><th>Opened</th></tr></thead>
        <tbody>{rows.map((a) => (
          <tr key={a.id} className="click" tabIndex={0} onClick={() => navigate(`/accounts/${a.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/accounts/${a.id}`)}>
            <td className="mono">{a.accountNo}</td><td><strong>{a.member?.fullName}</strong> <span className="muted small mono">{a.member?.membershipNo}</span></td>
            <td className="num"><Money paisa={a.balancePaisa} /></td><td><Badge value={a.status} /></td><td><DateText value={a.openedAt} /></td>
          </tr>))}</tbody>
      </table>{rows.length === 0 && <Empty>No accounts found.</Empty>}</div>
    </>
  );
}
