import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CloudUpload, Film, LayoutGrid, List, MoreVertical, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { deleteVideo, listVideos, startAnalysis } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { Video } from '../api/types';
import { MediaImg } from '../components/media';
import { ConfirmModal, Empty, ErrorState, Pagination, Spinner, videoStatus } from '../components/ui';
import { dateTime, duration } from '../fmt';

function Menu({ v, onDelete, onAnalyze }: { v: Video; onDelete: () => void; onAnalyze: () => void }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  return (
    <div className="kebab" onClick={(e) => e.preventDefault()}>
      <button className="icon-btn" aria-label={`Actions for ${v.filename}`} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.preventDefault(); setOpen(!open); }}><MoreVertical size={18} /></button>
      {open && <div className="kebab__list" role="menu"><button role="menuitem" onClick={() => nav(`/videos/${v.id}`)}>Open</button><button role="menuitem" onClick={onAnalyze}>Analyze</button><button role="menuitem" onClick={onDelete}>Delete</button></div>}
    </div>
  );
}

export default function Library() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState('ALL'), [sort, setSort] = useState('latest'), [view, setView] = useState<'grid' | 'list'>('grid'), [page, setPage] = useState(0);
  const [del, setDel] = useState<Video | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const qc = useQueryClient(), nav = useNavigate();
  useEffect(() => { setQ(params.get('q') ?? ''); setPage(0); }, [params]);
  const list = useQuery({ queryKey: ['videos', q, status, sort, page], queryFn: () => listVideos({ q, status, sort, page, size: 12 }), refetchInterval: 10000 });
  const rm = useMutation({ mutationFn: (id: string) => deleteVideo(id), onSuccess: () => { setDel(null); qc.invalidateQueries({ queryKey: ['videos'] }); }, onError: (e) => { setMsg(errorMessage(e)); setDel(null); } });
  const analyze = useMutation({ mutationFn: (id: string) => startAnalysis(id, crypto.randomUUID()), onSuccess: (a) => nav(`/analyses/${a.id}`), onError: (e) => setMsg(errorMessage(e)) });
  return (
    <>
      <div className="head"><div><h1 className="title">Video Library</h1><p className="subtitle">Manage and analyze your surveillance videos</p></div>
        <Link className="btn btn--primary" to="/videos/upload"><CloudUpload size={18} /> Upload Video</Link></div>
      <div className="toolbar">
        <div className="search grow" style={{ maxWidth: 'none' }}><Search size={18} /><input aria-label="Filter videos" placeholder="Search videos..." value={q} onChange={(e) => { setQ(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}); }} /></div>
        <select className="input" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="ALL">All Statuses</option><option value="COMPLETED">Completed</option><option value="PROCESSING">Processing</option><option value="FAILED">Failed</option></select>
        <select className="input" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}><option value="latest">Latest First</option><option value="oldest">Oldest First</option></select>
        <div className="seg"><button className={view === 'grid' ? 'on' : ''} aria-label="Grid view" onClick={() => setView('grid')}><LayoutGrid size={18} /></button><button className={view === 'list' ? 'on' : ''} aria-label="List view" onClick={() => setView('list')}><List size={18} /></button></div>
      </div>
      {msg && <div className="form-error" role="alert">{msg}</div>}
      {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Videos could not be loaded." onRetry={() => list.refetch()} /> :
        list.data!.items.length === 0 ? <Empty title="No videos uploaded yet." hint={q || status !== 'ALL' ? 'No videos match your filters.' : undefined} action={<Link className="btn btn--primary" to="/videos/upload">Upload Video</Link>} /> : <>
          {view === 'grid' ? <div className="vgrid">{list.data!.items.map((v) => (
            <Link key={v.id} to={`/videos/${v.id}`} className="vcard">
              <div className="vcard__img"><MediaImg kind="thumb" id={v.id} alt={`Thumbnail of ${v.filename}`} /><span className="vcard__dur"><Film size={12} /> {duration(v.durationSeconds)}</span></div>
              <div className="vcard__body"><div className="vcard__title"><span>{v.filename}</span><Menu v={v} onDelete={() => setDel(v)} onAnalyze={() => analyze.mutate(v.id)} /></div>
                <div className="vcard__meta"><span><Calendar size={13} /> {dateTime(v.createdAt)}</span><span>{v.width} × {v.height} · {v.frameRate} FPS</span></div>
                <div className="vcard__foot">{videoStatus(v)}<span className="link">{v.analysisCount} {v.analysisCount === 1 ? 'analysis' : 'analyses'}</span></div></div>
            </Link>))}</div> :
            <div className="card tbl-wrap"><table className="tbl"><thead><tr><th>Video</th><th>Uploaded</th><th>Duration</th><th>Resolution</th><th>Status</th><th>Analyses</th><th /></tr></thead><tbody>
              {list.data!.items.map((v) => <tr key={v.id}><td><Link to={`/videos/${v.id}`}>{v.filename}</Link></td><td>{dateTime(v.createdAt)}</td><td>{duration(v.durationSeconds)}</td><td>{v.width} × {v.height} · {v.frameRate} FPS</td><td>{videoStatus(v)}</td><td>{v.analysisCount}</td><td><Menu v={v} onDelete={() => setDel(v)} onAnalyze={() => analyze.mutate(v.id)} /></td></tr>)}
            </tbody></table></div>}
          <Pagination page={page} size={12} total={list.data!.total} onPage={setPage} label="videos" /></>}
      {del && <ConfirmModal title="Delete video" danger confirmLabel="Delete" busy={rm.isPending} message={`Delete "${del.filename}" permanently? The video file is removed; audit records are kept.`} onConfirm={() => rm.mutate(del.id)} onClose={() => setDel(null)} />}
    </>
  );
}
