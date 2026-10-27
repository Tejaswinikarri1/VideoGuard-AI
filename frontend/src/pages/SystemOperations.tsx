import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminJobs, adminSystem } from '../api/endpoints';
import { ErrorState, jobStatus, Pagination, Spinner } from '../components/ui';
import { bytes, dateTime } from '../fmt';

const Up = ({ s }: { s?: string }) => <span className={`status ${s === 'UP' ? 'status--completed' : 'status--failed'}`}>{s === 'UP' ? '● UP' : '✕ DOWN'}</span>;

export default function SystemOperations() {
  const sys = useQuery({ queryKey: ['admin-system'], queryFn: adminSystem, refetchInterval: 10000 });
  const [page, setPage] = useState(0), [status, setStatus] = useState('FAILED');
  const jobs = useQuery({ queryKey: ['admin-jobs', status, page], queryFn: () => adminJobs({ status, page, size: 8 }), refetchInterval: 10000 });
  if (sys.isLoading) return <Spinner />;
  if (sys.isError || !sys.data) return <ErrorState message="System status is unavailable (administrator access required)." onRetry={() => sys.refetch()} />;
  const s = sys.data, models = s.models;
  return (
    <>
      <h1 className="title">System Operations</h1><p className="subtitle">Operational status, job queue and model information</p>
      <div className="grid g4">
        <div className="card"><h2>Database</h2><Up s={s.database?.status} /></div>
        <div className="card"><h2>AI Service</h2><Up s={s.aiService?.status} /><div className="muted" style={{ marginTop: 8 }}>Detector loaded: {String(s.aiService?.detectorLoaded ?? false)}</div></div>
        <div className="card"><h2>Failed (24 h)</h2><b style={{ fontSize: 32 }}>{s.failedLast24h}</b></div>
        <div className="card"><h2>Storage</h2><div>Videos: {bytes(s.storage?.videosBytes)}</div>{s.storage?.diskTotalBytes && <div className="muted">Disk free {bytes(s.storage.diskUsableBytes)} of {bytes(s.storage.diskTotalBytes)}</div>}<div className="muted">Backend v{s.version}</div></div>
      </div>
      <div className="grid g2" style={{ marginTop: 16 }}>
        <div className="card"><h2>Job queue</h2><dl className="info">{Object.entries(s.queue ?? {}).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></Fragment>)}</dl></div>
        <div className="card"><h2>Loaded models</h2>{!models?.loaded ? <p className="down">No detector is loaded{models?.error ? `: ${models.error}` : ''}. Analyses cannot run until it is available.</p> : <>
          <dl className="info"><dt>Detector</dt><dd>{models.detector} ({models.weights})</dd><dt>Supported categories</dt><dd>{Object.entries(models.supportedCategories ?? {}).map(([c, l]) => `${c} (${(l as string[]).join(', ')})`).join('; ')}</dd>
            <dt>Unsupported</dt><dd>{(models.unsupportedCategories ?? []).join(', ') || 'none'}</dd><dt>Weapon model</dt><dd>{models.weapon?.enabled ? (models.weapon.loaded ? `loaded: ${models.weapon.labels.join(', ')}` : `unavailable: ${models.weapon.error}`) : 'disabled'}</dd></dl></>}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><div className="head"><h2>Jobs</h2><select className="input" style={{ width: 160 }} aria-label="Job status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option>FAILED</option><option>RUNNING</option><option>QUEUED</option><option>COMPLETED</option><option>CANCELLED</option></select></div>
        {jobs.isLoading ? <Spinner /> : !jobs.data?.items.length ? <p className="muted">No {status.toLowerCase()} jobs.</p> : <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Analysis</th><th>Video</th><th>Created</th><th>Status</th><th>Attempt</th><th>Error</th></tr></thead><tbody>
          {jobs.data.items.map((a) => <tr key={a.id}><td><Link to={`/analyses/${a.id}`}>{a.id.slice(0, 8)}</Link></td><td>{a.videoName}</td><td>{dateTime(a.createdAt)}</td><td>{jobStatus(a)}</td><td>{a.attempt}</td><td>{a.errorCode ? `${a.errorCode}: ${a.errorMessage}` : '—'}</td></tr>)}</tbody></table></div>}
        {jobs.data && <Pagination page={page} size={8} total={jobs.data.total} onPage={setPage} label="jobs" />}</div>
    </>
  );
}
