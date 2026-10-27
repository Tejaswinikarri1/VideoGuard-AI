import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Maximize2, PictureInPicture2, Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { clock } from '../fmt';
import { mediaUrl, useMediaToken } from './media';

export interface PlayerHandle { seek: (t: number) => void; play: () => void; pause: () => void; el: () => HTMLVideoElement | null }
interface Props { videoId: string; width?: number; height?: number; onTime?: (t: number) => void; children?: ReactNode; overlayInteractive?: boolean;
  fps?: number; showFrame?: boolean; compact?: boolean; label?: string }

/** Custom control bar (play, -10s, volume, time, scrubber, speed, PiP, fullscreen). Overlay children are drawn in the video's own aspect box. */
export const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer({ videoId, width, height, onTime, children, overlayInteractive, label }, ref) {
  const { data, refetch } = useMediaToken('video', videoId);
  const el = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const src = useRef<string | null>(null);
  const recoveryAttempted = useRef(false);
  const [, force] = useState(0);
  const [t, setT] = useState(0), [dur, setDur] = useState(0), [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [rate, setRate] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  if (data && !src.current) src.current = mediaUrl(data);

  useImperativeHandle(ref, () => ({ seek: (x) => { if (el.current) { el.current.currentTime = x; setT(x); } }, play, pause: () => el.current?.pause(), el: () => el.current }));
  useEffect(() => { const v = el.current; if (v) v.playbackRate = rate; }, [rate]);

  const recover = async () => { // media link expired mid-playback: fetch a fresh token and resume where we were
    if (recoveryAttempted.current) { setErr('The video could not be loaded.'); return; }
    recoveryAttempted.current = true;
    const pos = el.current?.currentTime ?? 0;
    const r = await refetch();
    if (r.data) { src.current = mediaUrl(r.data); setErr(null); force((n) => n + 1); setTimeout(() => { if (el.current) el.current.currentTime = pos; }, 200); }
    else setErr('The video could not be loaded.');
  };
  const play = () => {
    const result = el.current?.play();
    if (result) void result.catch(() => setErr('The video could not be played.'));
  };
  const toggle = () => { const v = el.current; if (v) (v.paused ? play() : v.pause()); };
  const ratio = width && height ? `${width} / ${height}` : '16 / 9';
  const speeds = [0.5, 1, 1.5, 2];

  return (
    <div className="player" aria-label={label ?? 'Video player'}>
      <div className="player__stage" ref={box} style={{ aspectRatio: ratio }}>
        {src.current ? <video key={src.current} ref={el} src={src.current} preload="metadata" playsInline onClick={toggle} onError={() => void recover()}
          onLoadedMetadata={(e) => { recoveryAttempted.current = false; setErr(null); setDur(e.currentTarget.duration); }} onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); onTime?.(e.currentTarget.currentTime); }}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} /> : <div className="img-ph" style={{ height: '100%' }} aria-busy />}
        {children && <div className="player__overlay" style={{ pointerEvents: overlayInteractive ? 'auto' : 'none' }}>{children}</div>}
        {err && <div className="player__err" role="alert">{err}</div>}
      </div>
      <div className="player__bar">
        <button aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>{playing ? <Pause size={20} /> : <Play size={20} />}</button>
        <button aria-label="Back 10 seconds" onClick={() => { if (el.current) el.current.currentTime = Math.max(0, el.current.currentTime - 10); }}><RotateCcw size={18} /></button>
        <button aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => { setMuted(!muted); if (el.current) el.current.muted = !muted; }}>{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
        <span className="player__time">{clock(t)} / {clock(dur)}</span>
        <input className="player__seek" type="range" min={0} max={dur || 1} step={0.05} value={Math.min(t, dur || 1)} aria-label="Seek"
          onChange={(e) => { const x = Number(e.target.value); if (el.current) el.current.currentTime = x; setT(x); }} />
        <button className="player__rate" aria-label="Playback speed" onClick={() => setRate(speeds[(speeds.indexOf(rate) + 1) % speeds.length])}>{rate}x</button>
        <button aria-label="Picture in picture" onClick={() => void el.current?.requestPictureInPicture?.()}><PictureInPicture2 size={18} /></button>
        <button aria-label="Fullscreen" onClick={() => void box.current?.requestFullscreen?.()}><Maximize2 size={18} /></button>
      </div>
    </div>
  );
});
