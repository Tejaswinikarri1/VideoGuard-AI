import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CalendarDays, ClipboardCheck, Video as VideoIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboard } from '../api/endpoints';
import type { Stat } from '../api/types';
import { SeverityLineChart, Donut } from '../components/Charts';
import { EventIcon } from '../components/EventIcon';
import { MediaImg } from '../components/media';
import { StageIcon } from '../components/StageIcon';
import { Empty, ErrorState, ReviewBadge, SeverityBadge, Spinner, videoStatus } from '../components/ui';
import { clock, dateParts, duration, eta, EVENT_LABEL, sentence } from '../fmt';

function StatCard({ cls, icon, label, s }: { cls: string; icon: ReactElement; label: string; s: Stat }) {
  const d = s.deltaPercent;
  return (
    <div className={`stat stat--${cls}`}>
      <div className="ico">{icon}</div><div><b>{s.value}</b><small>{label}</small></div>
      {s.trend && s.trend.some((n) => n > 0) && <div className="spark" aria-hidden>{s.trend.map((n, i) => <i key={i} style={{ height: `${12 + (n / Math.max(...s.trend!)) * 34}px` }} />)}</div>}
      <div className="delta">{d == null ? <span>no prior data</span> : <span className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '↑' : '↓'} {Math.abs(d)}%</span>}<br />vs last period</div>
    </div>
  );
}

const fmtD = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const rangeText = (n: number) => `${fmtD(new Date(Date.now() - n * 86400000))} – ${fmtD(new Date())}`;

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['dashboard', days], queryFn: () => dashboard(days), refetchInterval: 15000 });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="The dashboard could not be loaded." onRetry={() => q.refetch()} />;
  const d = q.data;
  const sev = d.severityTotals;
  return (
    <>
      <div className="head"><div><h1 className="title">Dashboard</h1><p className="subtitle">Overview of your surveillance analysis activity</p></div>
        <label className="range"><CalendarDays size={18} /><select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 90].map((n) => <option key={n} value={n}>{rangeText(n)}</option>)}</select></label></div>
      <div className="grid g4">
        <StatCard cls="blue" icon={<VideoIcon size={30} />} label="Total Videos" s={d.totalVideos} />
        <StatCard cls="purple" icon={<BarChart3 size={30} />} label="Total Analyses" s={d.totalAnalyses} />
        <StatCard cls="red" icon={<AlertTriangle size={30} />} label="Detected Events" s={d.detectedEvents} />
        <StatCard cls="amber" icon={<ClipboardCheck size={30} />} label="Pending Reviews" s={d.pendingReviews} />
      </div>
      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: 'minmax(0,1.18fr) minmax(0,1fr)' }}>
        <div className="card"><div className="head"><h2>Recent Videos</h2><Link to="/videos">View All ›</Link></div>
          {d.recentVideos.length === 0 ? <Empty title="No videos uploaded yet." action={<Link className="btn btn--primary" to="/videos/upload">Upload Video</Link>} /> :
            <div className="tbl-wrap"><table className="tbl tbl--compact"><thead><tr><th>Thumbnail</th><th>File Name</th><th>Uploaded</th><th>Duration</th><th>Resolution</th><th>Status</th><th /></tr></thead><tbody>
              {d.recentVideos.map((v) => <tr key={v.id}><td><div className="thumb-wrap"><MediaImg kind="thumb" id={v.id} alt="" className="thumb" /><span>{duration(v.durationSeconds)}</span></div></td><td><span className="trunc" title={v.filename}>{v.filename}</span></td><td>{dateParts(v.createdAt)[0]}<br /><span className="muted">{dateParts(v.createdAt)[1]}</span></td><td>{duration(v.durationSeconds)}</td><td>{v.width} × {v.height}<br /><span className="muted">{v.frameRate} FPS</span></td><td>{videoStatus(v)}</td><td><Link className="btn btn--ghost" to={`/videos/${v.id}`}>View</Link></td></tr>)}
            </tbody></table></div>}</div>
        <div className="card" style={{ gridColumn: '1 / -1' }}><div className="head"><div><h2>{d.activeJobs.length > 0 ? 'Active Analysis Jobs' : 'Analysis Jobs'}</h2>
          {d.activeJobs.length === 0 && <span className="muted">No analyses are running. Showing your latest jobs.</span>}</div><Link to="/analyses">View All ›</Link></div>
          {(d.activeJobs.length === 0 ? d.recentJobs : d.activeJobs).length === 0 ? <Empty title="No analysis jobs yet." hint="Start an analysis from a video to see its progress here." /> :
            <div className="tbl-wrap"><table className="tbl tbl--compact"><thead><tr><th>Video</th><th>Current Stage</th><th>Progress</th><th>Started</th><th>ETA</th></tr></thead><tbody>
              {(d.activeJobs.length === 0 ? d.recentJobs : d.activeJobs).map((a) => {
                const stage = a.status === 'QUEUED' ? 'Queued' : a.status === 'COMPLETED' ? 'Completed' : a.status === 'FAILED' ? 'Failed' : a.status === 'CANCELLED' ? 'Cancelled' : sentence(a.stage);
                const remaining = a.status === 'QUEUED' ? 'Queued' : a.status === 'COMPLETED' ? 'Complete' : a.status === 'FAILED' ? 'Failed' : a.status === 'CANCELLED' ? 'Cancelled' : eta(a.startedAt, a.progressPercent);
                return <tr key={a.id}><td><span className="cellrow"><MediaImg kind="thumb" id={a.videoId} alt="" className="thumb thumb--s" /><Link className="trunc" to={`/analyses/${a.id}`} title={a.videoName}>{a.videoName}</Link></span></td><td><span className="cellrow"><StageIcon stage={a.stage} size={26} /><span>{stage}</span></span></td><td>{a.progressPercent}%<br /><span className="minibar"><i style={{ width: `${a.progressPercent}%` }} /></span></td><td>{dateParts(a.startedAt ?? a.createdAt)[0]}<br /><span className="muted">{dateParts(a.startedAt ?? a.createdAt)[1]}</span></td><td>{remaining}</td></tr>;
              })}
            </tbody></table></div>}</div>
      </div>
      <div className="grid" style={{ marginTop: 16, gridTemplateColumns: '1.3fr 1fr 1.2fr' }}>
        <div className="card"><h2>Event Summary</h2><SeverityLineChart series={d.series} />
          <div className="muted" style={{ display: 'flex', gap: 16, justifyContent: 'center' }}><span><i className="dot" style={{ color: 'var(--sev-high)' }}>●</i> High ({sev.HIGH ?? 0})</span><span><i style={{ color: 'var(--sev-medium)' }}>●</i> Medium ({sev.MEDIUM ?? 0})</span><span><i style={{ color: 'var(--sev-low)' }}>●</i> Low ({sev.LOW ?? 0})</span></div></div>
        <div className="card"><h2>Event Types</h2><Donut data={d.eventTypes} /></div>
        <div className="card"><div className="head"><h2>Recent Events</h2><Link to="/reviews">View All ›</Link></div>
          {d.recentEvents.length === 0 ? <Empty title="No events yet." /> : <div className="tbl-wrap"><table className="tbl"><tbody>
            {d.recentEvents.map((e) => <tr key={e.id}><td style={{ width: 70 }}><MediaImg kind="evidence" id={e.hasEvidence ? e.id : null} alt="" className="thumb" /></td><td><span className="cellrow"><EventIcon type={e.eventType} size={28} /><span>{EVENT_LABEL[e.eventType]}<br /><span className="muted">{clock(e.startTimeSeconds)}</span></span></span></td><td><SeverityBadge s={e.severity} /></td><td><ReviewBadge s={e.reviewStatus} /></td></tr>)}
          </tbody></table></div>}</div>
      </div>
    </>
  );
}
