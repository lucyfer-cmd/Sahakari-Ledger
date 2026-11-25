import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDateMode } from '../lib/dateMode.jsx';
import { api } from '../api/http.js';
import { Icon } from './Icons.jsx';
import { Badge } from './ui.jsx';

const NAV = [
  { title: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: 'home', end: true }] },
  { title: 'Operations', items: [
    { to: '/members', label: 'Members', icon: 'users', show: (c) => c('member:read') },
    { to: '/accounts', label: 'Accounts', icon: 'wallet', show: (c) => c('account:read') },
    { to: '/accounts', label: 'My accounts', icon: 'wallet', show: (c) => c('account:read-own') && !c('account:read') },
    { to: '/loans', label: 'Loans', icon: 'loan', show: (c) => c('loan:read') },
    { to: '/loans', label: 'My loans', icon: 'loan', show: (c) => c('loan:read-own') && !c('loan:read') },
    { to: '/rates', label: 'Interest rates', icon: 'percent' },
  ] },
  { title: 'Oversight', items: [
    { to: '/ledger', label: 'Ledger', icon: 'ledger', show: (c) => c('ledger:read') },
    { to: '/reports', label: 'Reports', icon: 'chart', show: (c) => c('report:view') },
    { to: '/audit', label: 'Audit log', icon: 'audit', show: (c) => c('audit:read') },
  ] },
  { title: 'Administration', items: [{ to: '/users', label: 'Users', icon: 'shield', show: (c) => c('user:read') }] },
];

export default function Layout() {
  const { user, can, logout } = useAuth();
  const { mode, setMode } = useDateMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => { setOpen(false); setMenu(false); }, [location.pathname]);
  useEffect(() => {
    let alive = true;
    const load = () => api('/notifications').then((d) => alive && setUnread(d.unread)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [location.pathname]);
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const signOut = async () => { await logout(); navigate('/login'); };
  const initials = user.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Main navigation">
        <Link to="/" className="brand"><span className="brand-mark">S</span> Sahakari Ledger</Link>
        {NAV.map((g) => {
          const items = g.items.filter((i) => !i.show || i.show(can));
          if (!items.length) return null;
          return (
            <div className="nav-group" key={g.title}>
              <div className="nav-title">{g.title}</div>
              {items.map((i) => (
                <NavLink key={i.label} to={i.to} end={i.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{Icon[i.icon]}{i.label}</NavLink>
              ))}
            </div>
          );
        })}
        <div className="sidebar-foot">Amounts in Nepali rupees (Rs).<br />Dates follow the calendar chosen at the top.</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setOpen((o) => !o)}>{Icon.menu}</button>
          <span className="spacer" />
          <div className="seg" role="group" aria-label="Date format">
            {[['ad', 'AD'], ['bs', 'BS'], ['both', 'AD + BS']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}
          </div>
          <Link to="/notifications" className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>{Icon.bell}{unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}</Link>
          <div ref={menuRef}>
            <button className="user-chip" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
              <span className="avatar">{initials}</span><span className="small">{user.fullName.split(' ')[0]}</span>
            </button>
            {menu && (
              <div className="menu" role="menu">
                <div className="who"><strong>{user.fullName}</strong><div className="small muted">{user.email}</div><div style={{ marginTop: 4 }}><Badge value={user.role} /></div></div>
                <Link to="/change-password" role="menuitem">Change password</Link>
                <button role="menuitem" onClick={signOut}>Sign out</button>
              </div>
            )}
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
