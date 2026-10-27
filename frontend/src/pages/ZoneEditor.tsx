import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MousePointer2, Plus, Square, Trash2, Pentagon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { createZone, deleteZone, getVideo, listZones, updateZone } from '../api/endpoints';
import { ErrorState, Spinner } from '../components/ui';
import { PlayerHandle, VideoPlayer } from '../components/VideoPlayer';
import { clock } from '../fmt';

export const COLORS = ['#2f8cff', '#17b26a', '#f5a524', '#ef3b4a', '#8b5cf6', '#ec4899'];
interface Draft { key: string; id?: string; name: string; description: string; color: string; polygon: number[][]; enabled: boolean; dirty: boolean }
type Tool = 'select' | 'polygon' | 'rect';
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const r4 = (n: number) => Math.round(n * 10000) / 10000;

export default function ZoneEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate(), qc = useQueryClient();
  const player = useRef<PlayerHandle>(null);
  const svg = useRef<HTMLDivElement>(null);
  const video = useQuery({ queryKey: ['video', id], queryFn: () => getVideo(id) });
  const server = useQuery({ queryKey: ['zones', id], queryFn: () => listZones(id) });
  const [drafts, setDrafts] = useState<Draft[]>([]), [removed, setRemoved] = useState<string[]>([]), [sel, setSel] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select'), [pending, setPending] = useState<number[][]>([]), [drag, setDrag] = useState<{ key: string; i: number } | null>(null), [rectStart, setRectStart] = useState<number[] | null>(null);
  const [t, setT] = useState(0), [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (server.data) { setDrafts(server.data.map((z) => ({ key: z.id, id: z.id, name: z.name, description: z.description ?? '', color: z.color, polygon: z.polygon, enabled: z.enabled, dirty: false }))); setSel(server.data[0]?.id ?? null); } }, [server.data]);
  const cur = drafts.find((d) => d.key === sel) ?? null;
  const patch = (key: string, p: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...p, dirty: true } : d)));
  const pt = (e: React.PointerEvent | React.MouseEvent): number[] => { const r = svg.current!.getBoundingClientRect(); return [r4(clamp((e.clientX - r.left) / r.width)), r4(clamp((e.clientY - r.top) / r.height))]; };

  function addZone() {
    const key = `new-${crypto.randomUUID()}`;
    setDrafts((ds) => [...ds, { key, name: `Zone ${ds.length + 1}`, description: '', color: COLORS[ds.length % COLORS.length], polygon: [], enabled: true, dirty: true }]);
    setSel(key); setTool('polygon'); setPending([]);
  }
  function finishPolygon(points: number[][]) {
    if (cur && points.length >= 3) patch(cur.key, { polygon: points });
    setPending([]); setTool('select');
  }
  function onSvgDown(e: React.PointerEvent) {
    if (!cur) return;
    const p = pt(e);
    if (tool === 'polygon') {
      if (pending.length >= 3 && Math.hypot(p[0] - pending[0][0], p[1] - pending[0][1]) < 0.02) return finishPolygon(pending); // click first point to close
      setPending([...pending, p]);
    } else if (tool === 'rect') { setRectStart(p); }
  }
  function onSvgUp(e: React.PointerEvent) {
    if (tool === 'rect' && rectStart && cur) { const p = pt(e); patch(cur.key, { polygon: [[rectStart[0], rectStart[1]], [p[0], rectStart[1]], [p[0], p[1]], [rectStart[0], p[1]]] }); setRectStart(null); setTool('select'); }
    setDrag(null);
  }
  function onSvgMove(e: React.PointerEvent) {
    if (drag) { const p = pt(e); const d = drafts.find((x) => x.key === drag.key)!; patch(drag.key, { polygon: d.polygon.map((q, i) => (i === drag.i ? p : q)) }); }
  }

  const save = useMutation({
    mutationFn: async () => {
      for (const zid of removed) await deleteZone(id, zid);
      for (const d of drafts.filter((x) => x.dirty)) {
        if (d.polygon.length < 3) throw new Error(`"${d.name}" needs a polygon with at least 3 points. Draw it or delete the zone.`);
        const body = { name: d.name, description: d.description, color: d.color, polygon: d.polygon, enabled: d.enabled };
        if (d.id) await updateZone(id, d.id, body); else await createZone(id, body);
      }
    },
    onSuccess: () => { setRemoved([]); qc.invalidateQueries({ queryKey: ['zones', id] }); nav(`/videos/${id}`); },
    onError: (e) => setErr(e instanceof Error && !('response' in e) ? e.message : errorMessage(e)),
  });

  if (video.isLoading || server.isLoading) return <Spinner />;
  if (video.isError || !video.data) return <ErrorState message="Video not found." />;
  const v = video.data;
  const colorOf = (d: Draft) => d.color;
  const poly = (pts: number[][]) => pts.map((p) => `${p[0]},${p[1]}`).join(' ');
  return (
    <>
      <nav className="crumbs"><Link to="/videos">Video Library</Link> › <Link to={`/videos/${id}`}>{v.filename}</Link> › <b>Restricted Zones</b></nav>
      <h1 className="title">Restricted-Zone Editor</h1><p className="subtitle">Define areas where unauthorized entry should be detected. Intrusion events use the bottom-center of each tracked box.</p>
      {err && <div className="form-error" role="alert">{err}</div>}
      <div className="zone-grid">
        <div>
          <div style={{ position: 'relative' }}>
            <div className="tools" role="toolbar" aria-label="Drawing tools">
              <button className={tool === 'select' ? 'on' : ''} aria-label="Select and move points" onClick={() => { setTool('select'); setPending([]); }}><MousePointer2 size={20} /></button>
              <button className={tool === 'polygon' ? 'on' : ''} aria-label="Draw polygon" disabled={!cur} onClick={() => { setTool('polygon'); setPending([]); }}><Pentagon size={20} /></button>
              <button className={tool === 'rect' ? 'on' : ''} aria-label="Draw rectangle" disabled={!cur} onClick={() => setTool('rect')}><Square size={20} /></button>
              <button aria-label="Delete selected zone" disabled={!cur} onClick={() => { if (cur) { if (cur.id) setRemoved((r) => [...r, cur.id!]); setDrafts((ds) => ds.filter((d) => d.key !== cur.key)); setSel(null); } }}><Trash2 size={20} /></button>
            </div>
            <VideoPlayer ref={player} videoId={id} width={v.width} height={v.height} onTime={setT} overlayInteractive>
              <div ref={svg} style={{ position: 'relative', width: '100%', height: '100%', cursor: tool === 'select' ? 'default' : 'crosshair', touchAction: 'none' }}
                onPointerDown={onSvgDown} onPointerUp={onSvgUp} onPointerMove={onSvgMove} onDoubleClick={() => tool === 'polygon' && finishPolygon(pending)}>
                <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  {drafts.map((d) => d.polygon.length >= 3 && <polygon key={d.key} points={poly(d.polygon)} opacity={d.enabled ? 1 : 0.4} fill={`${colorOf(d)}40`} stroke={colorOf(d)} strokeWidth={d.key === sel ? 3 : 2} vectorEffect="non-scaling-stroke"
                    style={{ cursor: tool === 'select' ? 'pointer' : 'inherit' }} onPointerDown={(e) => { if (tool === 'select') { e.stopPropagation(); setSel(d.key); } }} />)}
                  {pending.length > 1 && cur && <polyline points={poly(pending)} fill="none" stroke={cur.color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />}
                </svg>
                {/* handles are HTML so they stay circular regardless of the video's aspect ratio */}
                {cur && tool === 'select' && cur.polygon.map((p, i) => <span key={i} className="handle" style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%`, borderColor: cur.color }}
                  onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ key: cur.key, i }); }} />)}
                {pending.map((p, i) => <span key={`p${i}`} className="handle" style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%`, borderColor: cur?.color, background: i === 0 ? cur?.color : '#fff', pointerEvents: 'none' }} />)}
              </div>
            </VideoPlayer>
          </div>
          <div className="muted" style={{ marginTop: 8, display: 'flex', gap: 12 }}><span className="badge rs-uncertain">Frame: {v.frameRate ? Math.round(t * v.frameRate).toLocaleString() : '—'} / {v.frameRate && v.durationSeconds ? Math.round(v.durationSeconds * v.frameRate).toLocaleString() : '—'}</span><span className="badge rs-uncertain">{clock(t, true)}</span>
            {tool === 'polygon' && <span>Click to add points; click the first point or double-click to close.</span>}{tool === 'rect' && <span>Drag-click opposite corners.</span>}</div>
        </div>
        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div className="card"><div className="head"><h2>Zones</h2><button className="btn btn--primary" onClick={addZone}><Plus size={16} /> Add Zone</button></div>
            {drafts.length === 0 ? <p className="muted">No zones yet. Intrusion detection stays inactive until a valid zone exists.</p> : drafts.map((d) => (
              <div key={d.key} className={`zone-item ${d.key === sel ? 'sel' : ''}`} onClick={() => setSel(d.key)}><i style={{ borderColor: d.color, background: `${d.color}33` }} /><div style={{ flex: 1 }}><b>{d.name}</b><div className="muted">{d.polygon.length} points</div></div>
                <button className="switch" role="switch" aria-checked={d.enabled} aria-label={`${d.name} enabled`} onClick={(e) => { e.stopPropagation(); patch(d.key, { enabled: !d.enabled }); }} /></div>))}</div>
          {cur && <div className="card"><h2>Zone Details</h2>
            <label className="lbl" htmlFor="zn">Name</label><input id="zn" className="input" maxLength={80} value={cur.name} onChange={(e) => patch(cur.key, { name: e.target.value })} />
            <label className="lbl" htmlFor="zd">Description (optional)</label><textarea id="zd" className="input" rows={3} maxLength={300} value={cur.description} onChange={(e) => patch(cur.key, { description: e.target.value })} />
            <div className="lbl">Zone Color</div><div className="swatches">{COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} className={cur.color === c ? 'on' : ''} style={{ background: c }} onClick={() => patch(cur.key, { color: c })} />)}</div>
            <div className="head" style={{ marginTop: 14 }}><span className="lbl" style={{ margin: 0 }}>Points ({cur.polygon.length})</span><button className="icon-btn" aria-label="Copy coordinates" onClick={() => navigator.clipboard?.writeText(JSON.stringify(cur.polygon))}><Copy size={16} /></button></div>
            <div className="pts">{cur.polygon.length === 0 ? <span className="muted">Draw the zone on the video.</span> : cur.polygon.map((p, i) => <div key={i}><span className="muted">{i + 1}</span>({p[0].toFixed(2)}, {p[1].toFixed(2)})</div>)}</div></div>}
          <div style={{ display: 'flex', gap: 10 }}><button className="btn btn--primary" style={{ flex: 1 }} disabled={save.isPending || (!removed.length && !drafts.some((d) => d.dirty))} onClick={() => { setErr(null); save.mutate(); }}>{save.isPending ? 'Saving…' : 'Save Changes'}</button><button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => nav(`/videos/${id}`)}>Cancel</button></div>
        </div>
      </div>
    </>
  );
}
