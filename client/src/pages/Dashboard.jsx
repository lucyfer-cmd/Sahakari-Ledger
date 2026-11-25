import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { Badge, DateText, Empty, LoadError, Loading, Money, PageHead, Stat } from '../components/ui.jsx';
import { dateTime, money } from '../lib/format.js';

function StaffHome({ data }) {
  const { user, can } = useAuth();
  const s = data.summary;
  const check = s.lastIntegrityCheck;
  const tips = {
    admin: 'Review loan applications, manage staff and keep an eye on overdue payments.',
    teller: 'Register members, record deposits and withdrawals, and collect loan instalments.',
    auditor: 'You have read-only access. Run the integrity check to prove the ledger has not been altered.',
  };
  return (
    <>
      <PageHead title={`Welcome, ${user.fullName.split(' ')[0]}`} subtitle={tips[user.role]} />
      <div className="grid cols-4">
        <Stat label="Active members" value={s.activeMembers} sub={`${s.savingsAccounts} savings accounts`} />
        <Stat label="Total savings" value={money(s.totalSavingsPaisa)} sub="held for members" />
        <Stat label="Loans to collect" value={money(s.loanReceivablePaisa)} sub="principal and interest still due" />
        <Stat label="Overdue" value={s.overdueInstallments} tone={s.overdueInstallments ? 'warn' : 'good'} sub={s.overdueInstallments ? money(s.overduePaisa) : 'nothing overdue'} />
      </div>
      <div className="grid cols-4" style={{ marginTop: '1rem' }}>
        <Stat label="Awaiting decision" value={s.loansAwaitingDecision} sub="loan applications" />
        <Stat label="Pending accounts" value={s.pendingMemberAccounts} sub="member logins to approve" />
        <Stat label="Deposits today" value={money(data.today.depositsPaisa)} sub={`${data.today.entries} ledger entries today`} />
        <Stat label="Withdrawals today" value={money(data.today.withdrawalsPaisa)} />
      </div>
      <div className="grid cols-2" style={{ marginTop: '1rem' }}>
        <div className="card">
          <div className="card-head"><h2>Ledger integrity</h2>{can('ledger:read') && <Link className="btn secondary sm" to="/ledger">Open ledger</Link>}</div>
          <p style={{ margin: 0 }}>{s.ledgerEntries} entries, last entry number <strong>#{s.lastSeq}</strong>.</p>
          {check ? (
            <div className={`alert ${check.ok ? 'success' : 'error'}`} style={{ marginTop: '.8rem', marginBottom: 0 }}>
              Last check <strong>{check.ok ? 'passed' : 'FOUND A PROBLEM'}</strong> on {dateTime(check.at)}{check.by ? ` by ${check.by}` : ''}.
            </div>
          ) : <div className="alert info" style={{ marginTop: '.8rem', marginBottom: 0 }}>No integrity check has been run yet.</div>}
        </div>
        <div className="card">
          <div className="card-head"><h2>Quick actions</h2></div>
          <div className="actions">
            {can('member:create') && <Link className="btn" to="/members?new=1">Register a member</Link>}
            {can('member:read') && <Link className="btn secondary" to="/members">Find a member</Link>}
            {can('loan:approve') && <Link className="btn" to="/loans">Review loans</Link>}
            {can('ledger:verify') && <Link className="btn" to="/ledger">Verify ledger</Link>}
            {can('report:view') && <Link className="btn secondary" to="/reports">Reports</Link>}
            {can('user:read') && <Link className="btn secondary" to="/users">Users</Link>}
          </div>
        </div>
      </div>
    </>
  );
}

function MemberHome({ data }) {
  const { user } = useAuth();
  const { loan, nextInstallment: next } = data;
  return (
    <>
      <PageHead title={`Welcome, ${user.fullName.split(' ')[0]}`} subtitle="Your savings and loan at a glance." />
      <div className="grid cols-3">
        {data.accounts.length === 0 && <div className="card"><Empty>You do not have a savings account yet. Please visit the cooperative office.</Empty></div>}
        {data.accounts.map((a) => (
          <Link key={a.id} to={`/accounts/${a.id}`} style={{ textDecoration: 'none' }}><Stat label={`Savings ${a.accountNo}`} value={money(a.balancePaisa)} sub="View statement" /></Link>
        ))}
        {loan && <Link to={`/loans/${loan.id}`} style={{ textDecoration: 'none' }}><Stat label={`Loan ${loan.loanNo}`} value={money(loan.principalPaisa)} sub={`Status: ${loan.status}`} /></Link>}
        {next && <Stat label="Next instalment" value={money(next.principalDuePaisa + next.interestDuePaisa - next.paidPaisa)} sub={<>Due <DateText value={next.dueDate} /></>} tone={next.status === 'overdue' ? 'warn' : ''} />}
      </div>
      <div className="grid cols-2" style={{ marginTop: '1rem' }}>
        <div className="card">
          <div className="card-head"><h2>Your loan</h2></div>
          {loan ? (
            <dl className="kv">
              <dt>Loan number</dt><dd>{loan.loanNo} <Badge value={loan.status} /></dd>
              <dt>Term</dt><dd>{loan.termMonths} months</dd>
              <dt>Still to pay</dt><dd><Money paisa={data.remainingPaisa} /></dd>
            </dl>
          ) : <><p className="muted">You have no loan right now.</p><Link className="btn" to="/loans">Apply for a loan</Link></>}
        </div>
        <div className="card">
          <div className="card-head"><h2>Notifications</h2></div>
          <p style={{ marginTop: 0 }}>{data.unreadNotifications ? `You have ${data.unreadNotifications} unread notification(s).` : 'You are all caught up.'}</p>
          <Link className="btn secondary" to="/notifications">Open notifications</Link>
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useFetch('/dashboard');
  if (loading) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  return data.role === 'member' ? <MemberHome data={data} /> : <StaffHome data={data} />;
}
