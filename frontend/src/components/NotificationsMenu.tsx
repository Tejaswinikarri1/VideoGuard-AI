import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listAnalyses, pendingCount, searchEvents } from '../api/endpoints';
import { ago, EVENT_LABEL } from '../fmt';
import { EventIcon } from './EventIcon';
import { useClickOutside } from './useClickOutside';

/** Bell with a real notification centre: latest events awaiting review + recent analysis outcomes. */
export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useClickOutside(ref, () => setOpen(false), open);
  const count = useQuery({ queryKey: ['pending-count'], queryFn: pendingCount, refetchInterval: 30000 });
  const events = useQuery({ queryKey: ['notif-events'], queryFn: () => searchEvents({ status: 'PENDING', size: 5 }), enabled: open });
  const jobs = useQuery({ queryKey: ['notif-jobs'], queryFn: () => listAnalyses({ size: 4 }), enabled: open });
  const n = count.data ?? 0;
  return (
    <div className="notif" ref={ref}>
      <button className="icon-btn" aria-label={`Notifications, ${n} events pending review`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={22} />{n > 0 && <b className="bell">{n > 99 ? '99+' : n}</b>}
      </button>
      {open && (
        <div className="notif__panel" role="dialog" aria-label="Notifications">
          <div className="notif__head"><b>Notifications</b>{n > 0 && <span className="badge rs-pending">{n} pending</span>}</div>
          <div className="notif__sec">Awaiting review</div>
          {events.isLoading ? <div className="muted pad">Loading…</div> : !events.data?.items.length ? <div className="muted pad">Nothing is waiting for review.</div> :
            events.data.items.map((e) => (
              <button key={e.id} className="notif__row" onClick={() => { setOpen(false); nav(`/analyses/${e.analysisId}`); }}>
                <EventIcon type={e.eventType} size={32} /><span><b>{EVENT_LABEL[e.eventType]}</b><small>{e.videoName} · {ago(e.createdAt)}</small></span>
              </button>))}
          <div className="notif__sec">Recent analyses</div>
          {jobs.isLoading ? <div className="muted pad">Loading…</div> : !jobs.data?.items.length ? <div className="muted pad">No analyses yet.</div> :
            jobs.data.items.map((a) => (
              <button key={a.id} className="notif__row" onClick={() => { setOpen(false); nav(`/analyses/${a.id}`); }}>
                <span className="notif__st">{a.status === 'COMPLETED' ? <CheckCircle2 size={18} color="var(--success)" /> : a.status === 'FAILED' ? <XCircle size={18} color="var(--danger)" /> : <Loader2 size={18} className="spin" />}</span>
                <span><b>{a.status === 'COMPLETED' ? 'Analysis completed' : a.status === 'FAILED' ? 'Analysis failed' : a.status === 'CANCELLED' ? 'Analysis cancelled' : `Analysis ${a.progressPercent}%`}</b><small>{a.videoName} · {ago(a.completedAt ?? a.startedAt ?? a.createdAt)}</small></span>
              </button>))}
          <div className="notif__foot"><Link to="/reviews" onClick={() => setOpen(false)}>View all pending reviews</Link></div>
        </div>
      )}
    </div>
  );
}
