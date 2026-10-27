import { EVENT_COLOR, EVENT_LABEL } from '../fmt';

export function SeverityLineChart({ series }: { series: { date: string; HIGH: number; MEDIUM: number; LOW: number }[] }) {
  const W = 640, H = 200, P = { l: 34, r: 10, t: 10, b: 24 };
  const max = Math.max(5, ...series.flatMap((d) => [d.HIGH, d.MEDIUM, d.LOW]));
  const top = Math.ceil(max / 5) * 5;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(series.length - 1, 1);
  const y = (v: number) => H - P.b - (v / top) * (H - P.t - P.b);
  const line = (k: 'HIGH' | 'MEDIUM' | 'LOW') => series.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d[k])}`).join(' ');
  const cols: Record<string, string> = { HIGH: 'var(--sev-high)', MEDIUM: 'var(--sev-medium)', LOW: 'var(--sev-low)' };
  const labelEvery = Math.max(1, Math.floor(series.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Events per day by severity" className="chart">
      {[0, 1, 2, 3, 4].map((i) => { const v = (top * i) / 4; return <g key={i}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 4" /><text x={P.l - 6} y={y(v) + 4} textAnchor="end" className="chart__t">{Math.round(v)}</text></g>; })}
      {(['LOW', 'MEDIUM', 'HIGH'] as const).map((k) => <g key={k}><path d={`${line(k)} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={cols[k]} opacity=".12" /><path d={line(k)} fill="none" stroke={cols[k]} strokeWidth="2" /></g>)}
      {series.map((d, i) => i % labelEvery === 0 && <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" className="chart__t">{new Date(d.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</text>)}
    </svg>
  );
}

export function Donut({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);
  const R = 70, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 180 180" role="img" aria-label="Events by type" width="180" height="180">
        <circle cx="90" cy="90" r={R} fill="none" stroke="var(--border)" strokeWidth="22" />
        {entries.map(([k, v]) => { const len = (v / total) * C; const el = <circle key={k} cx="90" cy="90" r={R} fill="none" stroke={EVENT_COLOR[k] ?? '#8b5cf6'} strokeWidth="22" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} transform="rotate(-90 90 90)" />; acc += len; return el; })}
        <text x="90" y="92" textAnchor="middle" className="donut__n">{total}</text><text x="90" y="112" textAnchor="middle" className="chart__t">Total Events</text>
      </svg>
      <ul className="legend">{entries.length === 0 ? <li className="muted">No events in this period</li> : entries.map(([k, v]) => <li key={k}><i style={{ background: EVENT_COLOR[k] ?? '#8b5cf6' }} />{EVENT_LABEL[k] ?? k}<b>{v}</b><span className="muted">{Math.round((v / total) * 100)}%</span></li>)}</ul>
    </div>
  );
}
