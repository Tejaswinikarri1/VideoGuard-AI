import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Download, Loader2, Settings as Cog } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { analysisLogs, cancelAnalysis } from '../api/endpoints';
import type { Analysis } from '../api/types';
import { ConfirmModal } from '../components/ui';
import { VideoPlayer } from '../components/VideoPlayer';
import { bytes, dateTime, duration } from '../fmt';

export const STEPS: [string, string, string][] = [
  ['JOB_ACCEPTED', 'Job Accepted', 'Analysis job has been queued and validated'], ['PREPARING_VIDEO', 'Preparing Video', 'Extracting metadata and preparing frames'],
  ['FRAME_SAMPLING', 'Frame Sampling', 'Sampling frames for analysis'], ['OBJECT_DETECTION', 'Object Detection', 'Detecting objects with the configured YOLO detector'],
  ['OBJECT_TRACKING', 'Object Tracking', 'Tracking objects across frames using ByteTrack'], ['ACTIVITY_ANALYSIS', 'Activity Analysis', 'Detecting loitering, running, intrusion and weapons'],
  ['EVENT_CORRELATION', 'Event Correlation', 'Correlating events and removing duplicates'], ['EVIDENCE_GENERATION', 'Evidence Generation', 'Generating evidence snapshots'],
  ['PERSISTING_RESULTS', 'Persisting Results', 'Saving analysis results to the database'], ['COMPLETED', 'Completed', 'Analysis finished'],
];

function span(a: Analysis, stage: string): string {
  const t = a.stageTimings.find((s) => s.stage === stage);
  if (!t?.startedAt) return '';
  const end = t.completedAt ? new Date(t.completedAt).getTime() : Date.now();
  return duration((end - new Date(t.startedAt).getTime()) / 1000);
}

export function AnalysisProgress({ a }: { a: Analysis }) {
  const qc = useQueryClient();
  const active = a.status === 'QUEUED' || a.status === 'RUNNING';
  const logs = useQuery({ queryKey: ['logs', a.id], queryFn: () => analysisLogs(a.id), refetchInterval: active ? 3000 : false });
  const [auto, setAuto] = useState(true), [confirm, setConfirm] = useState(false), [err, setErr] = useState<string | null>(null), [, tick] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!active) return; const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, [active]);
  useEffect(() => { if (auto && box.current) box.current.scrollTop = box.current.scrollHeight; }, [logs.data, auto]);
  const cancel = useMutation({ mutationFn: () => cancelAnalysis(a.id), onSuccess: () => { setConfirm(false); qc.invalidateQueries({ queryKey: ['analysis', a.id] }); }, onError: (e) => { setErr(errorMessage(e)); setConfirm(false); } });
  const idx = STEPS.findIndex((s) => s[0] === a.stage);
  const elapsed = a.startedAt ? duration(((a.completedAt ? new Date(a.completedAt).getTime() : Date.now()) - new Date(a.startedAt).getTime()) / 1000) : '—';
  const headBadge = a.status === 'COMPLETED' ? 'status--completed' : a.status === 'FAILED' ? 'status--failed' : a.status === 'CANCELLED' ? 'status--cancelled' : 'status--processing';
  return (
    <>
      <nav className="crumbs"><Link to="/analyses">Analyses &amp; Events</Link> › <Link to={`/videos/${a.videoId}`}>{a.videoName}</Link> › <b>Analysis {a.id.slice(0, 8)}</b></nav>
      <div className="head"><div><h1 className="title">Analysis Progress</h1><p className="subtitle">Real-time progress of your video analysis</p></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`status ${headBadge}`} role="status">{active ? <Cog size={16} className="spin-slow" /> : null}{a.status === 'RUNNING' ? 'Processing' : a.status === 'QUEUED' ? 'Queued' : a.status.charAt(0) + a.status.slice(1).toLowerCase()} · started {dateTime(a.startedAt ?? a.createdAt)}</span>
          <Link className="btn btn--ghost" to={`/analyses/${a.id}`} aria-disabled={a.status !== 'COMPLETED'} style={a.status !== 'COMPLETED' ? { opacity: .5, pointerEvents: 'none' } : {}}>View Results</Link>
          <button className="btn btn--danger" disabled={!active} onClick={() => setConfirm(true)}>Cancel Analysis</button></div></div>
      {err && <div className="form-error" role="alert">{err}</div>}
      {a.status === 'FAILED' && <div className="form-error" role="alert"><b>{a.errorCode}</b>: {a.errorMessage ?? 'The analysis failed.'}</div>}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.5fr)' }}>
        <div className="card"><h2>Video Information</h2>
          <VideoPlayer videoId={a.videoId} width={a.videoWidth} height={a.videoHeight} />
          <dl className="info" style={{ marginTop: 12 }}>
            <dt>File</dt><dd>{a.videoName} · {duration(a.videoDuration)} · {a.videoWidth}×{a.videoHeight} · {a.videoFrameRate} FPS · {bytes(a.videoSizeBytes)}</dd>
            <dt>Analysis ID</dt><dd>{a.id}</dd><dt>Started by</dt><dd>{a.requestedByName ?? '—'}</dd><dt>Restricted zones</dt><dd>{a.zoneCount} zone{a.zoneCount === 1 ? '' : 's'} configured</dd>
            <dt>Started at</dt><dd>{dateTime(a.startedAt)}</dd><dt>Elapsed time</dt><dd>{elapsed}</dd><dt>Attempt</dt><dd>{a.attempt || 1}</dd></dl></div>
        <div className="card"><div className="head"><div><h2>Analysis Pipeline</h2><p className="muted" style={{ margin: 0 }}>Step-by-step progress of the video analysis process</p></div>
          <div style={{ minWidth: 220 }}><div className="head"><span className="muted">Overall Progress</span><b style={{ fontSize: 26 }}>{a.progressPercent}%</b></div><div className="bar" role="progressbar" aria-valuenow={a.progressPercent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${a.progressPercent}%` }} /></div></div></div>
          <div className="steps" style={{ marginTop: 10 }}>
            {STEPS.map(([k, title, sub], i) => {
              const done = a.status === 'COMPLETED' || i < idx, cur = a.status === 'RUNNING' && i === idx, failed = a.status === 'FAILED' && i === idx;
              return (
                <div key={k} className={`step ${done ? 'done' : ''} ${cur ? 'cur' : ''}`}>
                  <span>{done ? <Check size={18} color="var(--success)" /> : cur ? <Loader2 className="spin" size={18} /> : <Clock size={16} color="var(--text-dim)" />}</span>
                  <span className="num">{i + 1}</span><div><b>{title}</b><small>{sub}</small></div>
                  <span>{cur && <><span className="minibar" style={{ width: 120 }}><i style={{ width: `${a.stageProgressPercent}%` }} /></span> {a.stageProgressPercent}% </>}<span className="muted">{span(a, k)}</span></span>
                  <span className={`status ${done ? 'status--completed' : cur ? 'status--processing' : failed ? 'status--failed' : 'status--neutral'}`} style={{ justifySelf: 'end' }}>{done ? 'Completed' : cur ? 'Processing' : failed ? 'Failed' : 'Pending'}</span>
                </div>);
            })}</div></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><div className="head"><div><h2>Analysis Logs</h2><p className="muted" style={{ margin: 0 }}>Real processing logs from the analysis pipeline</p></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><label className="check" style={{ fontSize: 14 }}><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-scroll</label>
          <button className="btn btn--ghost" onClick={() => { const url = URL.createObjectURL(new Blob([(logs.data ?? []).join('\n')], { type: 'text/plain' })); const l = document.createElement('a'); l.href = url; l.download = `analysis-${a.id}.log`; l.click(); URL.revokeObjectURL(url); }}><Download size={16} /> Download Logs</button></div></div>
        <div className="logs" ref={box} role="log" aria-live="off">{logs.data?.length ? logs.data.map((l, i) => <div key={i}>{l}</div>) : <span className="muted">{active ? 'Waiting for the worker to pick up the job…' : 'No logs.'}</span>}</div></div>
      {confirm && <ConfirmModal title="Cancel analysis" danger confirmLabel="Cancel Analysis" busy={cancel.isPending} message="Stop this analysis? Partial results are discarded; you can start a new run later." onConfirm={() => cancel.mutate()} onClose={() => setConfirm(false)} />}
    </>
  );
}
