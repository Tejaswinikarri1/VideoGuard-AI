import { useQuery } from '@tanstack/react-query';
import { Brain, CloudUpload, FileText, FileVideo, FolderOpen, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { getConfig, uploadVideo } from '../api/endpoints';
import { bytes } from '../fmt';

type Row = { file: File; pct: number; state: 'uploading' | 'processing' | 'error' | 'cancelled'; error?: string };

export default function Upload() {
  const cfg = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: Infinity });
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [over, setOver] = useState(false);
  const [row, setRow] = useState<Row | null>(null);
  const [location, setLocation] = useState('');
  const formats = cfg.data?.formats ?? ['MP4', 'MOV', 'AVI', 'MKV', 'WEBM'];

  async function start(file: File) {
    const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
    if (!formats.includes(ext)) return setRow({ file, pct: 0, state: 'error', error: `Unsupported format ".${ext.toLowerCase()}". Use ${formats.join(', ')}.` });
    if (cfg.data && file.size > cfg.data.maxUploadBytes) return setRow({ file, pct: 0, state: 'error', error: `File is larger than the ${bytes(cfg.data.maxUploadBytes)} limit.` });
    abort.current = new AbortController();
    setRow({ file, pct: 0, state: 'uploading' });
    try {
      const v = await uploadVideo(file, (pct) => setRow((r) => (r ? { ...r, pct, state: pct >= 100 ? 'processing' : 'uploading' } : r)), abort.current.signal, location);
      nav(`/videos/${v.id}`); // upload and AI analysis are separate actions: land on the detail page
    } catch (e) {
      if (abort.current?.signal.aborted) setRow((r) => (r ? { ...r, state: 'cancelled', error: 'Upload cancelled.' } : r));
      else setRow((r) => (r ? { ...r, state: 'error', error: errorMessage(e, 'The upload failed. Please try again.') } : r));
    }
  }
  const pick = (f?: File | null) => f && start(f);
  return (
    <>
      <div className="head"><div><h1 className="title">Upload Video</h1><p className="subtitle">Add a new surveillance video</p></div><nav className="crumbs"><a href="/dashboard">Home</a> › <b style={{ color: 'var(--link)' }}>Upload Video</b></nav></div>
      <div className="card">
        <div className={`drop ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
          <CloudUpload size={64} color="var(--link)" /><h2>Drag and drop your video file here</h2><p className="muted">or</p>
          <button className="btn btn--primary" onClick={() => input.current?.click()} disabled={row?.state === 'uploading' || row?.state === 'processing'}><FolderOpen size={18} /> Browse Files</button>
          <input ref={input} type="file" hidden accept=".mp4,.mov,.avi,.mkv,.webm,video/*" aria-label="Choose a video file" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <p className="muted">Supported formats: {formats.join(', ')}<br />Maximum file size: {cfg.data ? bytes(cfg.data.maxUploadBytes) : '…'}{cfg.data ? ` · Maximum duration: ${Math.round(cfg.data.maxDurationSeconds / 60)} min` : ''}</p>
        </div>
        <div style={{ marginTop: 16 }}><label className="lbl" htmlFor="uloc" style={{ marginTop: 0 }}>Camera location (optional)</label><input id="uloc" className="input" maxLength={120} placeholder="e.g. Parking Lot – Entrance" value={location} onChange={(e) => setLocation(e.target.value)} disabled={row?.state === 'uploading' || row?.state === 'processing'} /></div>
        {row && <div className="uprow" role="status"><div className="ico"><FileVideo size={22} /></div><div><b>{row.file.name}</b><div className="muted">{bytes(row.file.size)} • {row.file.name.split('.').pop()?.toUpperCase()}</div></div>
          {row.state === 'error' || row.state === 'cancelled' ? <span className="down" style={{ flex: 1 }}>{row.error}</span> : <><div className="bar"><i style={{ width: `${row.pct}%` }} /></div><b style={{ color: 'var(--link)' }}>{row.state === 'processing' ? 'Processing…' : `${row.pct}%`}</b></>}
          {row.state === 'uploading' ? <button className="btn btn--ghost" onClick={() => abort.current?.abort()}>Cancel</button> : row.state === 'processing' ? <span className="muted">Verifying and extracting metadata</span> : <button className="btn btn--ghost" onClick={() => setRow(null)}>Dismiss</button>}</div>}
      </div>
      <div className="grid g4" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 16 }}>
        <div className="feat"><div className="ico"><ShieldCheck size={24} /></div><div><b>Secure Upload</b><small>Files are validated by content, stored privately and only reachable with short-lived signed links.</small></div></div>
        <div className="feat"><div className="ico"><FileText size={24} /></div><div><b>Automatic Metadata Extraction</b><small>Duration, resolution and frame rate are read from the actual file with FFprobe.</small></div></div>
        <div className="feat"><div className="ico"><Brain size={24} /></div><div><b>Ready for AI Analysis</b><small>After upload, you can configure restricted zones and start analysis.</small></div></div>
      </div>
    </>
  );
}
