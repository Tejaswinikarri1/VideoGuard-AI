import type { ReactElement, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, FileText, Film, Gauge, HardDrive, Info, Play, ScanLine, Trash2, User, Layers, MapPinned } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { deleteVideo, getVideo, listZones, patchVideo, startAnalysis, videoAnalyses } from '../api/endpoints';
import { MediaImg } from '../components/media';
import { ConfirmModal, Empty, ErrorState, jobStatus, Spinner, StatusBadge } from '../components/ui';
import { PlayerHandle, VideoPlayer } from '../components/VideoPlayer';
import { bytes, dateTime, duration } from '../fmt';
import { useAuth } from '../auth/AuthContext';

export default function VideoDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate(), qc = useQueryClient(), { user } = useAuth();
  const player = useRef<PlayerHandle>(null);
  const [tab, setTab] = useState<'details' | 'history' | 'zones'>('details');
  const [del, setDel] = useState(false), [editing, setEditing] = useState(false), [desc, setDesc] = useState(''), [loc, setLoc] = useState(''), [err, setErr] = useState<string | null>(null), [strip, setStrip] = useState(0);
  const v = useQuery({ queryKey: ['video', id], queryFn: () => getVideo(id) });
  const hist = useQuery({ queryKey: ['video-analyses', id], queryFn: () => videoAnalyses(id), refetchInterval: 5000 });
  const zones = useQuery({ queryKey: ['zones', id], queryFn: () => listZones(id) });
  const analyze = useMutation({ mutationFn: () => startAnalysis(id, crypto.randomUUID()), onSuccess: (a) => nav(`/analyses/${a.id}`), onError: (e) => setErr(errorMessage(e)) });
  const rm = useMutation({ mutationFn: () => deleteVideo(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['videos'] }); nav('/videos'); }, onError: (e) => { setErr(errorMessage(e)); setDel(false); } });
  const save = useMutation({ mutationFn: () => patchVideo(id, { description: desc, location: loc }), onSuccess: () => { setEditing(false); qc.invalidateQueries({ queryKey: ['video', id] }); }, onError: (e) => setErr(errorMessage(e)) });
  if (v.isLoading) return <Spinner />;
  if (v.isError || !v.data) return <ErrorState message="This video was not found or you do not have access to it." onRetry={() => v.refetch()} />;
  const vid = v.data, owner = vid.ownerId === user?.id, ready = vid.metadataStatus === 'COMPLETED';
  const rows: [ReactElement, string, ReactNode][] = [
    [<FileText size={16} />, 'Filename', vid.filename], [<MapPinned size={16} />, 'Location', vid.location || '—'], [<Clock size={16} />, 'Upload date', dateTime(vid.createdAt)], [<Clock size={16} />, 'Duration', duration(vid.durationSeconds)],
    [<ScanLine size={16} />, 'Resolution', vid.width ? `${vid.width} × ${vid.height}` : '—'], [<Gauge size={16} />, 'Frame rate', vid.frameRate ? `${vid.frameRate} FPS` : '—'],
    [<HardDrive size={16} />, 'File size', bytes(vid.sizeBytes)], [<Film size={16} />, 'Format', `${vid.format}${vid.codec ? ` (${vid.codec.toUpperCase()})` : ''}`],
    [<Info size={16} />, 'Metadata status', <span className={`status status--${ready ? 'completed' : 'failed'}`}>{ready ? 'Completed' : vid.metadataStatus}</span>], [<User size={16} />, 'Uploaded by', `${vid.ownerName ?? '—'} (${vid.ownerEmail ?? ''})`],
  ];
  const actions = (
    <>
      <button className="btn btn--primary" disabled={!ready || analyze.isPending} onClick={() => analyze.mutate()}><Play size={16} /> Analyze Video</button>
      <Link className="btn btn--ghost" to={`/videos/${id}/zones`} aria-disabled={!ready}><MapPinned size={16} /> Configure Zones</Link>
      <button className="btn btn--danger" disabled={!owner} onClick={() => setDel(true)}><Trash2 size={16} /> Delete Video</button>
    </>
  );
  return (
    <>
      <nav className="crumbs"><Link to="/videos">Video Library</Link> › <b>{vid.filename}</b></nav>
      <div className="head"><h1 className="title">{vid.filename} <span className="badge rs-uncertain" style={{ verticalAlign: 'middle', fontSize: 14 }}>{vid.format}</span></h1><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div></div>
      {err && <div className="form-error" role="alert">{err}</div>}
      {!ready && <div className="form-error" role="alert">Metadata extraction failed{vid.metadataError ? `: ${vid.metadataError}` : ''}. Analysis is unavailable.</div>}
      <div className="grid g-main" style={{ marginTop: 14 }}>
        <div>
          {ready ? <VideoPlayer ref={player} videoId={id} width={vid.width} height={vid.height} /> : <Empty title="Video unavailable" />}
          {ready && vid.frameCount > 0 && <div className="strip" aria-label="Frame previews">{Array.from({ length: vid.frameCount }, (_, i) => <button key={i} className={strip === i ? 'on' : ''} aria-label={`Jump to preview ${i + 1}`} onClick={() => { setStrip(i); player.current?.seek(((i + 0.5) / vid.frameCount) * (vid.durationSeconds ?? 0)); }}><MediaImg kind="frame" id={id} index={i} alt="" /></button>)}</div>}
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div className="tabs" role="tablist">{([['details', 'Details'], ['history', 'Analysis History'], ['zones', 'Restricted Zones']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div style={{ padding: 18 }}>
            {tab === 'details' && <>
              <h2>Video Information</h2><dl className="info">{rows.map(([i, k, val]) => <Fragment key={k}><dt>{i} {k}</dt><dd>{val}</dd></Fragment>)}</dl>
              <div className="head" style={{ marginTop: 18 }}><h2>Details</h2>{owner && !editing && <button className="btn btn--ghost" onClick={() => { setDesc(vid.description ?? ''); setLoc(vid.location ?? ''); setEditing(true); }}>Edit</button>}</div>
              {editing ? <><label className="lbl" htmlFor="vloc">Camera location</label><input id="vloc" className="input" maxLength={120} placeholder="e.g. Parking Lot – Entrance" value={loc} onChange={(e) => setLoc(e.target.value)} /><label className="lbl" htmlFor="vdesc">Description</label><textarea id="vdesc" className="input" rows={3} maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} /><div className="row-end"><button className="btn btn--ghost" onClick={() => setEditing(false)}>Cancel</button><button className="btn btn--primary" disabled={save.isPending} onClick={() => save.mutate()}>Save</button></div></> : <p className="muted">{vid.description || 'No description.'}</p>}
              <h2 style={{ marginTop: 18 }}>Quick Actions</h2><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div></>}
            {tab === 'history' && (hist.isLoading ? <Spinner /> : !hist.data?.length ? <Empty title="No analyses yet." hint="Start an analysis to generate events." /> :
              hist.data.map((a) => <Link key={a.id} to={`/analyses/${a.id}`} className="ev" style={{ color: 'inherit', display: 'block' }}>
                <div className="ev__head"><b>Analysis {a.id.slice(0, 8)}</b>{jobStatus(a)}</div>
                <div className="ev__meta">By {a.requestedByName ?? '—'} · Started {dateTime(a.startedAt ?? a.createdAt)}{a.completedAt && ` · Completed ${dateTime(a.completedAt)}`}</div>
                <div className="ev__meta">{a.status === 'RUNNING' && <>Progress {a.progressPercent}% · </>}{a.eventCount} events{a.errorMessage && <span className="down"> · {a.errorMessage}</span>}</div></Link>))}
            {tab === 'zones' && (zones.isLoading ? <Spinner /> : !zones.data?.length ? <Empty title="No restricted zones." hint="Intrusion detection is only active when a valid zone exists." action={<Link className="btn btn--primary" to={`/videos/${id}/zones`}>Configure Zones</Link>} /> :
              <>{zones.data.map((z) => <div key={z.id} className="zone-item"><i style={{ borderColor: z.color, background: `${z.color}33` }} /><div><b>{z.name}</b><div className="muted">{z.polygon.length} points · {z.enabled ? 'enabled' : 'disabled'}</div></div></div>)}</>)}
          </div>
        </div>
      </div>
      {del && <ConfirmModal title="Delete video" danger confirmLabel="Delete" busy={rm.isPending} message={`Delete "${vid.filename}" permanently?`} onConfirm={() => rm.mutate()} onClose={() => setDel(false)} />}
    </>
  );
}
