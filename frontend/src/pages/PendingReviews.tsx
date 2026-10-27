import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Eye, List, RefreshCcw, Search, Video as VideoIcon } from 'lucide-react';
import { useState } from 'react';
import { listAnalyses, searchEvents } from '../api/endpoints';
import type { EventItem } from '../api/types';
import { EventIcon } from '../components/EventIcon';
import { MediaImg } from '../components/media';
import { ReviewDialog } from '../components/ReviewDialog';
import { Empty, ErrorState, Pagination, ReviewBadge, SeverityBadge, Spinner } from '../components/ui';
import { clock, dateTime, EVENT_LABEL, pct } from '../fmt';

export default function PendingReviews() {
  const [q, setQ] = useState(''), [type, setType] = useState('ALL'), [sev, setSev] = useState('ALL'), [status, setStatus] = useState('PENDING'), [page, setPage] = useState(0);
  const [open, setOpen] = useState<EventItem | null>(null);
  const list = useQuery({ queryKey: ['events', 'queue', q, type, sev, status, page], queryFn: () => searchEvents({ q, type, severity: sev, status, page, size: 8 }), refetchInterval: 20000 });
  const pending = useQuery({ queryKey: ['events', 'count', 'PENDING'], queryFn: () => searchEvents({ status: 'PENDING', size: 1 }) });
  const total = useQuery({ queryKey: ['events', 'count', 'ALL'], queryFn: () => searchEvents({ size: 1 }) });
  const done = useQuery({ queryKey: ['analyses', 'COMPLETED'], queryFn: () => listAnalyses({ status: 'COMPLETED', size: 1 }) });
  const reset = () => { setQ(''); setType('ALL'); setSev('ALL'); setStatus('PENDING'); setPage(0); };
  const tot = total.data?.total ?? 0, pen = pending.data?.total ?? 0;
  const cards = [[<Clock size={26} />, pen, 'Pending Reviews', '#ef3b4a'], [<List size={26} />, tot, 'Total Events', '#8b5cf6'], [<VideoIcon size={26} />, done.data?.total ?? 0, 'Analyses Completed', '#0b63f6'], [<CheckCircle2 size={26} />, tot - pen, 'Reviewed', '#17b26a']] as const;
  return (
    <>
      <div className="head"><div><h1 className="title">Pending Reviews</h1><p className="subtitle">Events awaiting human review</p></div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 150px)' }}>{cards.map(([i, n, l, c]) => <div key={l} className="stat" style={{ padding: 12, gap: 10 }}><div className="ico" style={{ background: c, width: 44, height: 44 }}>{i}</div><div><b style={{ fontSize: 22 }}>{n}</b><small>{l}</small></div></div>)}</div></div>
      <div className="card">
        <div className="toolbar">
          <div className="search grow" style={{ maxWidth: 'none' }}><Search size={18} /><input aria-label="Search events" placeholder="Search events by video name or type..." value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} /></div>
          <select className="input" aria-label="Event type" value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}><option value="ALL">All Event Types</option>{Object.entries(EVENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="input" aria-label="Severity" value={sev} onChange={(e) => { setSev(e.target.value); setPage(0); }}><option value="ALL">All Severities</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select>
          <select className="input" aria-label="Review status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="PENDING">Pending</option><option value="ALL">All</option><option>CONFIRMED</option><option>REJECTED</option><option>UNCERTAIN</option></select>
          <button className="btn btn--ghost" onClick={reset}><RefreshCcw size={16} /> Clear Filters</button></div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Events could not be loaded." onRetry={() => list.refetch()} /> : list.data!.items.length === 0 ? <Empty title={status === 'PENDING' ? 'No events are waiting for review.' : 'No events match your filters.'} /> :
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Thumbnail</th><th>Event Type</th><th>Video</th><th>Timestamp</th><th>Confidence</th><th>Severity</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {list.data!.items.map((e) => <tr key={e.id}>
              <td><div className="thumb-wrap"><MediaImg kind="evidence" id={e.hasEvidence ? e.id : null} alt="" className="thumb" /><span>{clock(e.startTimeSeconds).replace(/^00:/, '')}</span></div></td>
              <td><span className="cellrow" style={{ alignItems: 'flex-start' }}><EventIcon type={e.eventType} size={42} /><span><b>{EVENT_LABEL[e.eventType]}</b><div className="muted" style={{ maxWidth: 280, fontSize: 13 }}>{e.description}</div></span></span></td><td><b>{e.videoName}</b>{e.videoLocation && <div className="muted" style={{ fontSize: 13 }}>{e.videoLocation}</div>}</td><td>{dateTime(e.createdAt)}<br /><span className="muted">{clock(e.startTimeSeconds)}</span></td><td>{pct(e.confidence)}</td>
              <td><SeverityBadge s={e.severity} /></td><td><ReviewBadge s={e.reviewStatus} /></td><td><button className="btn btn--primary" onClick={() => setOpen(e)}><Eye size={16} /> Review</button></td></tr>)}
          </tbody></table></div>}
        {list.data && <Pagination page={page} size={8} total={list.data.total} onPage={setPage} label="events" />}
      </div>
      <p className="muted" style={{ marginTop: 10 }}><AlertTriangle size={14} /> Severity is a prioritization aid, not a decision. Only a reviewer can confirm, reject or mark an event uncertain.</p>
      {open && <ReviewDialog event={open} onClose={() => setOpen(null)} />}
    </>
  );
}
