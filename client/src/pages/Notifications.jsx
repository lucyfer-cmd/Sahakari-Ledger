import { api } from '../api/http.js';
import { useFetch } from '../hooks/useFetch.js';
import { Empty, LoadError, Loading, PageHead } from '../components/ui.jsx';
import { dateTime } from '../lib/format.js';

export default function Notifications() {
  const { data, loading, error, reload } = useFetch('/notifications');
  const read = async (n) => { if (!n.readAt) { await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {}); reload(); } };
  const readAll = async () => { await api('/notifications/read-all', { method: 'POST' }).catch(() => {}); reload(); };
  if (loading && !data) return <Loading />;
  if (error) return <LoadError error={error} retry={reload} />;
  return (
    <>
      <PageHead title="Notifications" subtitle={data.unread ? `${data.unread} unread` : 'You are all caught up.'}>
        {data.unread > 0 && <button className="btn secondary" onClick={readAll}>Mark all as read</button>}
      </PageHead>
      <div className="card" style={{ padding: 0 }}>
        {data.notifications.length === 0 ? <Empty>No notifications yet.</Empty> : data.notifications.map((n) => (
          <div key={n.id} onClick={() => read(n)} style={{ padding: '.9rem 1.25rem', borderBottom: '1px solid var(--line)', background: n.readAt ? '#fff' : 'var(--blue-l)', cursor: n.readAt ? 'default' : 'pointer', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
            <div><div style={{ fontWeight: n.readAt ? 400 : 600 }}>{n.message}</div><div className="muted small">{dateTime(n.createdAt)}</div></div>
            {!n.readAt && <span className="badge blue">New</span>}
          </div>
        ))}
      </div>
    </>
  );
}
