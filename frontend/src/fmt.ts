export function duration(sec?: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '--:--:--';
  const s = Math.max(0, Math.round(sec));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}
/** Playback clock: truncates (never rounds up), so 41.67 s reads 00:00:41(.67). */
export function clock(sec: number, withFraction = false): string {
  const s = Math.max(0, sec);
  const whole = Math.floor(s);
  const base = [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60].map((n) => String(n).padStart(2, '0')).join(':');
  return withFraction ? `${base}.${String(Math.floor((s % 1) * 100 + 1e-6)).padStart(2, '0')}` : base;
}

export function bytes(n?: number | null): string {
  if (n == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}
export function dateTime(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';
}
/** Two-line cell: date on top, 24-hour time below (as in the mockups). */
export function dateParts(iso?: string | null): [string, string] {
  if (!iso) return ['—', ''];
  const d = new Date(iso);
  return [d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })];
}
export const sentence = (s: string) => { const t = s.replace(/_/g, ' ').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
export function dateOnly(iso?: string | null): string { return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }) : '—'; }
export function pct(n: number): string { return `${Math.round(n * 100)}%`; }
export const EVENT_LABEL: Record<string, string> = { PERSON_LOITERING: 'Person Loitering', SUDDEN_RUNNING: 'Sudden Running', RESTRICTED_AREA_INTRUSION: 'Restricted Area Intrusion', WEAPON_DETECTION: 'Weapon Detection', FALL_DETECTED: 'Fall Detected' };
export const EVENT_COLOR: Record<string, string> = { SUDDEN_RUNNING: '#ef4a5a', RESTRICTED_AREA_INTRUSION: '#f5a524', PERSON_LOITERING: '#2f8cff', WEAPON_DETECTION: '#17b26a', FALL_DETECTED: '#8b5cf6' };
export const initials = (name?: string) => {
  if (/\bAI Service\b/i.test(name ?? '')) return 'AI';
  const w = (name ?? '?').replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  return (w.length ? w.slice(0, 2).map((p) => p[0]).join('') : '?').toUpperCase();
};
/** ETA derived from measured progress and elapsed time; null when there is not enough signal. */
export function eta(startedAt: string | undefined, progress: number): string {
  if (!startedAt || progress < 3 || progress >= 100) return '—';
  const el = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const rem = Math.max(0, (el * (100 - progress)) / progress);
  return rem < 90 ? '< 2 min' : `~ ${Math.round(rem / 60)} min`;
}

/** "5 min ago" style relative time. */
export function ago(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
/** Stable avatar colour from a name. */
export function avatarColor(name?: string): string {
  const palette = ['#0b63f6', '#8b5cf6', '#17b26a', '#f5a524', '#ec4899', '#06b6d4', '#ef4a5a'];
  let h = 0; for (const c of name ?? '?') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
