import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Info, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { analysisEvents, download, listZones, videoAnalyses } from '../api/endpoints';
import type { Analysis, EventItem } from '../api/types';
import { EventIcon } from '../components/EventIcon';
import { MediaImg } from '../components/media';
import { ReviewDialog } from '../components/ReviewDialog';
import { Timeline } from '../components/Timeline';
import { Empty, ErrorState, jobStatus, ReviewBadge, SeverityBadge, Spinner } from '../components/ui';
import { PlayerHandle, VideoPlayer } from '../components/VideoPlayer';
import { clock, dateTime, duration, EVENT_LABEL, pct } from '../fmt';

/** Bounding box from the event's measured trajectory (nearest sample in time), drawn only while the playhead is inside the event. */
function BoxOverlay({ ev, t }: { ev: EventItem | null; t: number }) {
  if (!ev || t < ev.startTimeSeconds - 0.5 || t > ev.endTimeSeconds + 0.5 || !ev.trajectory.length) return null;
  const s = ev.trajectory.reduce((b, p) => (Math.abs(p[0] - t) < Math.abs(b[0] - t) ? p : b));
  if (Math.abs(s[0] - t) > 1.5) return null;
  return <div className="bbox" style={{ left: `${s[1] * 100}%`, top: `${s[2] * 100}%`, width: `${(s[3] - s[1]) * 100}%`, height: `${(s[4] - s[2]) * 100}%` }}><span>{ev.trackId != null ? `Track ${ev.trackId}` : EVENT_LABEL[ev.eventType]}</span></div>;
}

export function AnalysisResults({ a }: { a: Analysis }) {
  const nav = useNavigate();
  const player = useRef<PlayerHandle>(null);
  const [type, setType] = useState('ALL'), [sev, setSev] = useState('ALL'), [status, setStatus] = useState('ALL'), [q, setQ] = useState('');
  const [tab, setTab] = useState<'events' | 'history' | 'zones'>('events');
  const [t, setT] = useState(0), [sel, setSel] = useState<EventItem | null>(null), [review, setReview] = useState<EventItem | null>(null);
  const events = useQuery({ queryKey: ['events', a.id, type, sev, status, q], queryFn: () => analysisEvents(a.id, { type, severity: sev, status, q }) });
  const all = useQuery({ queryKey: ['events', a.id, 'ALL', 'ALL', 'ALL', ''], queryFn: () => analysisEvents(a.id, {}) });
  const hist = useQuery({ queryKey: ['video-analyses', a.videoId], queryFn: () => videoAnalyses(a.videoId), enabled: tab === 'history' });
  const zones = useQuery({ queryKey: ['zones', a.videoId], queryFn: () => listZones(a.videoId), enabled: tab === 'zones' });
  const list = events.data ?? [];
  const jump = (e: EventItem) => { setSel(e); player.current?.seek(e.startTimeSeconds); };
  const sum = a.eventSummary;
  const dur = a.videoDuration ?? 0;
  const steps = useMemo(() => ['Frame Sampling', 'Object Detection', 'Object Tracking', 'Activity Analysis', 'Event Correlation', 'Evidence Generation'], []);
  return (
    <>
      <nav className="crumbs"><Link to="/videos">Video Library</Link> › <Link to={`/videos/${a.videoId}`}>{a.videoName}</Link> › <Link to="/analyses">Analysis {a.id.slice(0, 8)}</Link> › <b>Results</b></nav>
      <div className="head"><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><button className="icon-btn" aria-label="Back" onClick={() => nav(-1)}><ArrowLeft /></button><div><h1 className="title">Analysis Results</h1><p className="subtitle" style={{ margin: 0 }}>View detected events and evidence from your video analysis.</p></div></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{jobStatus(a)}<button className="btn btn--primary" onClick={() => download(`/analyses/${a.id}/export`, {}, `analysis-${a.id}.csv`)}><Download size={16} /> Download Results</button></div></div>
      <div className="card" style={{ margin: '12px 0', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <MediaImg kind="thumb" id={a.videoId} alt="" className="thumb" /><b style={{ fontSize: 18 }}>{a.videoName}</b><span className="muted">{dateTime(a.createdAt)}</span><span className="muted">{duration(a.videoDuration)}</span><span className="muted">{a.videoWidth} × {a.videoHeight}</span><span className="badge rs-uncertain">Analysis {a.id.slice(0, 8)}</span>
        {a.modelVersion && <span className="muted" title="Model and pipeline versions used for this run">Model: {a.modelVersion} · pipeline {a.pipelineVersion}</span>}</div>
      <div className="grid g-main">
        <div>
          <VideoPlayer ref={player} videoId={a.videoId} width={a.videoWidth} height={a.videoHeight} onTime={setT}><BoxOverlay ev={sel} t={t} /></VideoPlayer>
          <Timeline duration={dur} events={all.data ?? []} current={t} selectedId={sel?.id} onSeek={(x) => player.current?.seek(x)} onSelect={setSel} />
        </div>
        <div className="card" style={{ padding: 0, alignSelf: 'start' }}>
          <div className="tabs" role="tablist">{([['events', `Events (${all.data?.length ?? a.eventCount})`], ['history', 'Analysis History'], ['zones', 'Restricted Zones']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div style={{ padding: 14 }}>
            {tab === 'events' && <>
              <div className="toolbar" style={{ marginBottom: 12 }}>
                <select className="input" aria-label="Event type" value={type} onChange={(e) => setType(e.target.value)}><option value="ALL">All Types</option>{Object.entries(EVENT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <select className="input" aria-label="Severity" value={sev} onChange={(e) => setSev(e.target.value)}><option value="ALL">All Severity</option><option>HIGH</option><option>MEDIUM</option><option>LOW</option></select>
                <select className="input" aria-label="Review status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All Status</option><option>PENDING</option><option>CONFIRMED</option><option>REJECTED</option><option>UNCERTAIN</option></select>
                <div className="search grow" style={{ minWidth: 160 }}><Search size={16} /><input aria-label="Search events" placeholder="Search events..." value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                {events.isLoading ? <Spinner /> : events.isError ? <ErrorState message="Events could not be loaded." onRetry={() => events.refetch()} /> : list.length === 0 ? <Empty title={all.data?.length ? 'No events match your filters.' : 'No events were detected in this video.'} hint={all.data?.length ? undefined : 'This only means the configured rules did not trigger; it is not a guarantee that nothing happened.'} /> :
                  list.map((e) => (
                    <div key={e.id} className={`ev ${sel?.id === e.id ? 'sel' : ''}`} onClick={() => jump(e)}>
                      {e.hasEvidence ? <MediaImg kind="evidence" id={e.id} alt="Evidence" /> : <div className="img-ph" title={e.evidenceStatus === 'FAILED' ? 'Evidence generation failed' : 'No evidence'}>No image</div>}
                      <div className="ev__body"><div className="ev__head"><span className="cellrow"><EventIcon type={e.eventType} size={26} round /><b>{EVENT_LABEL[e.eventType]}</b></span><span className="ev__badges"><SeverityBadge s={e.severity} /><ReviewBadge s={e.reviewStatus} /></span></div>
                        <div className="ev__meta">{clock(e.startTimeSeconds)} – {clock(e.endTimeSeconds)} · Confidence: {pct(e.confidence)}{e.trackId != null && ` · Track ${e.trackId}`}</div>
                        <div style={{ fontSize: 13 }}>{e.description}</div>
                        <div className="ev__act"><button className="btn btn--ghost" onClick={(ev) => { ev.stopPropagation(); jump(e); }}>Jump to Moment</button><button className="btn btn--primary" onClick={(ev) => { ev.stopPropagation(); setReview(e); }}>Review</button></div></div></div>))}</div></>}
            {tab === 'history' && (hist.isLoading ? <Spinner /> : hist.data?.map((h) => <Link key={h.id} to={`/analyses/${h.id}`} className="ev" style={{ color: 'inherit', display: 'block' }}><div className="ev__head"><b>Analysis {h.id.slice(0, 8)}{h.id === a.id && ' (current)'}</b>{jobStatus(h)}</div><div className="ev__meta">{dateTime(h.createdAt)} · {h.requestedByName} · {h.eventCount} events</div></Link>))}
            {tab === 'zones' && (zones.isLoading ? <Spinner /> : !zones.data?.length ? <Empty title="No restricted zones configured." /> : zones.data.map((z) => <div key={z.id} className="zone-item"><i style={{ borderColor: z.color, background: `${z.color}33` }} /><div><b>{z.name}</b><div className="muted">{z.polygon.length} points · {z.enabled ? 'enabled' : 'disabled'}</div></div></div>))}
          </div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><div className="summary">
        <div><h2 style={{ margin: 0 }}><Info size={16} /> Analysis Summary</h2><div className="muted">{a.videoName} · {a.videoWidth}×{a.videoHeight} · {duration(a.videoDuration)}</div></div>
        <div><span style={{ color: 'var(--link)' }}>Total Events</span><big style={{ color: 'var(--link)' }}>{sum.total ?? 0}</big></div>
        <div><span style={{ color: 'var(--success)' }}>Confirmed</span><big style={{ color: 'var(--success)' }}>{sum.confirmed ?? 0}</big></div>
        <div><span style={{ color: 'var(--warning)' }}>Pending</span><big style={{ color: 'var(--warning)' }}>{sum.pending ?? 0}</big></div>
        <div><span style={{ color: 'var(--danger)' }}>High Severity</span><big style={{ color: 'var(--danger)' }}>{sum.highSeverity ?? 0}</big></div></div>
        <p className="muted" style={{ marginBottom: 0 }}>Completed steps: {steps.join(' · ')}. AI results can contain false positives and false negatives; every event requires human review.</p></div>
      {review && <ReviewDialog event={review} onClose={() => setReview(null)} onDone={(e) => setSel((s) => (s?.id === e.id ? e : s))} />}
    </>
  );
}
