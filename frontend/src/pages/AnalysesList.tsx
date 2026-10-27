import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listAnalyses } from '../api/endpoints';
import { Empty, ErrorState, jobStatus, Pagination, Spinner } from '../components/ui';
import { dateTime } from '../fmt';

export default function AnalysesList() {
  const [status, setStatus] = useState('ALL'), [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ['analyses', status, page], queryFn: () => listAnalyses({ status, page, size: 10 }), refetchInterval: 5000 });
  return (
    <>
      <div className="head"><div><h1 className="title">Analyses &amp; Events</h1><p className="subtitle">Every analysis run on your videos. Previous runs are never overwritten.</p></div>
        <select className="input" style={{ width: 190 }} aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="ALL">All Statuses</option><option value="ACTIVE">Active</option><option>COMPLETED</option><option>FAILED</option><option>CANCELLED</option></select></div>
      <div className="card">{q.isLoading ? <Spinner /> : q.isError ? <ErrorState message="Analyses could not be loaded." onRetry={() => q.refetch()} /> : !q.data!.items.length ? <Empty title="No analyses yet." hint="Open a video and choose Analyze Video." /> :
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Analysis</th><th>Video</th><th>Started by</th><th>Started</th><th>Status</th><th>Progress</th><th>Events</th></tr></thead><tbody>
          {q.data!.items.map((a) => <tr key={a.id}><td><Link to={`/analyses/${a.id}`}>{a.id.slice(0, 8)}</Link></td><td>{a.videoName}</td><td>{a.requestedByName}</td><td>{dateTime(a.startedAt ?? a.createdAt)}</td><td>{jobStatus(a)}{a.errorMessage && <div className="down" style={{ fontSize: 12 }}>{a.errorMessage}</div>}</td><td>{a.progressPercent}%</td><td>{a.eventCount}</td></tr>)}
        </tbody></table></div>}{q.data && <Pagination page={page} size={10} total={q.data.total} onPage={setPage} label="analyses" />}</div>
    </>
  );
}
