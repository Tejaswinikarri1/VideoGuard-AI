import type { EventItem } from '../api/types';
import { clock } from '../fmt';

/** Markers are the same persisted events shown as cards. Shape + color distinguish severity (not color alone). */
export function Timeline({ duration, events, current, selectedId, onSeek, onSelect }: { duration: number; events: EventItem[]; current: number; selectedId?: string | null; onSeek: (t: number) => void; onSelect: (e: EventItem) => void }) {
  const ticks = Array.from({ length: 6 }, (_, i) => (duration * i) / 5);
  const pos = (t: number) => `${Math.min(100, Math.max(0, (t / Math.max(duration, 1)) * 100))}%`;
  return (
    <div className="timeline" aria-label="Event timeline">
      <div className="timeline__track" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * duration); }}>
        <div className="timeline__playhead" style={{ left: pos(current) }}><span>{clock(current)}</span></div>
        {events.map((ev) => (
          <button key={ev.id} className={`marker sev-${ev.severity.toLowerCase()} ${selectedId === ev.id ? 'sel' : ''}`} style={{ left: pos(ev.startTimeSeconds) }}
            title={`${ev.eventType.replace(/_/g, ' ').toLowerCase()} · ${ev.severity} · ${clock(ev.startTimeSeconds)}`} aria-label={`${ev.eventType} at ${clock(ev.startTimeSeconds)}, ${ev.severity}`}
            onClick={(e) => { e.stopPropagation(); onSelect(ev); onSeek(ev.startTimeSeconds); }}>
            {ev.severity === 'HIGH' ? '▲' : ev.severity === 'MEDIUM' ? '■' : '●'}
          </button>
        ))}
      </div>
      <div className="timeline__ticks">{ticks.map((t, i) => <span key={i}>{clock(t).replace(/^00:/, '')}</span>)}</div>
    </div>
  );
}
