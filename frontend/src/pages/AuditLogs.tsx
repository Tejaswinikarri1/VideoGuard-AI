import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Calendar, CheckCircle2, ChevronDown, ClipboardCheck, Cpu, Download, Film, Flag, KeyRound, LogIn, LogOut, MapPin, MoreVertical, Play, Settings as Cog, Shield, ShieldCheck, Trash2, TriangleAlert, Upload as UploadIcon, User as UserIcon, UserCog, UserPlus, XCircle, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { adminAudit, adminAuditActions, adminUsers, download, type AuditFilters } from '../api/endpoints';
import type { AuditLog } from '../api/types';
import { Avatar } from '../components/Avatar';
import { Empty, ErrorState, Modal, Pagination, Spinner } from '../components/ui';
import { useClickOutside } from '../components/useClickOutside';
import { dateParts } from '../fmt';

type Tile = [LucideIcon, string, string]; // icon, colour, subtitle
const ACTIONS: Record<string, Tile> = {
  UPLOAD_VIDEO: [UploadIcon, '#8b5cf6', 'Uploaded a new video file'], START_ANALYSIS: [Play, '#17b26a', 'Started video analysis'], UPDATE_USER_ROLE: [UserCog, '#f5a524', 'Modified user role'],
  UPDATE_USER_STATUS: [UserCog, '#f5a524', 'Changed account status'], CREATE_USER: [UserPlus, '#06b6d4', 'Created a user'], REVIEW_EVENT: [ClipboardCheck, '#ec4899', 'Recorded a review decision'],
  ANALYSIS_COMPLETED: [Cog, '#2f8cff', 'Completed video analysis'], ANALYSIS_FAILED: [TriangleAlert, '#ef4a5a', 'Analysis failed'], CANCEL_ANALYSIS: [XCircle, '#f5a524', 'Cancelled an analysis'],
  UPDATE_ZONE: [MapPin, '#2f8cff', 'Updated restricted zone'], DELETE_ZONE: [Trash2, '#ef4a5a', 'Deleted restricted zone'], LOGIN_FAILED: [TriangleAlert, '#ef4a5a', 'Failed login attempt'],
  LOGIN: [LogIn, '#17b26a', 'Signed in'], LOGOUT: [LogOut, '#8fa6d1', 'Signed out'], REGISTER: [UserPlus, '#17b26a', 'Registered an account'], DELETE_VIDEO: [Trash2, '#ef4a5a', 'Deleted video file'],
  UPDATE_VIDEO: [Film, '#8b5cf6', 'Updated video details'], UPDATE_PROFILE: [UserIcon, '#2f8cff', 'Updated profile'], CHANGE_PASSWORD: [KeyRound, '#f5a524', 'Changed password'],
};
const RESOURCES: Record<string, [LucideIcon, string]> = { VIDEO: [Film, '#8b5cf6'], ANALYSIS: [Cpu, '#17b26a'], USER: [UserIcon, '#f5a524'], EVENT: [Flag, '#ef4a5a'], ZONE: [ShieldCheck, '#2f8cff'], AUTH: [Shield, '#ef4a5a'] };

function IconTile({ I, c, size = 40 }: { I: LucideIcon; c: string; size?: number }) {
  return <span className="evicon" style={{ width: size, height: size, borderRadius: 10, background: `${c}26`, color: c, borderColor: `${c}55` }}><I size={size * 0.5} /></span>;
}
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const longDate = (d?: string) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Any');

function Row({ a, onOpen }: { a: AuditLog; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const [AI, ac, sub] = ACTIONS[a.action] ?? [Cog, '#8fa6d1', a.action.replace(/_/g, ' ').toLowerCase()];
  const [RI, rc] = RESOURCES[a.resourceType ?? ''] ?? [Cog, '#8fa6d1'];
  const [d, t] = dateParts(a.createdAt);
  const ok = a.outcome === 'SUCCESS';
  return (
    <tr>
      <td className="nowrap">{d}<br /><span className="muted">{t}</span></td>
      <td><span className="cellrow"><Avatar name={a.actorName ?? a.actorEmail} size={38} /><span><b>{a.actorName ?? '—'}</b><div className="muted">{a.actorEmail}</div></span></span></td>
      <td><span className="cellrow"><IconTile I={AI} c={ac} /><span><b>{a.actionLabel ?? a.action}</b><div className="muted">{sub}</div></span></span></td>
      <td><span className="cellrow"><IconTile I={RI} c={rc} /><span><b style={{ textTransform: 'capitalize' }}>{(a.resourceType ?? 'N/A').toLowerCase()}</b><div className="muted">{a.resourceId ? a.resourceId.slice(0, 14) : 'N/A'}</div></span></span></td>
      <td><span className={`pill ${ok ? 'pill--ok' : 'pill--bad'}`}>{ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}{a.outcome}</span></td>
      <td className="muted nowrap">{a.requestId}</td>
      <td style={{ maxWidth: 320 }}>{a.details}</td>
      <td><div className="kebab" ref={ref}><button className="icon-btn" aria-label="Row actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><MoreVertical size={18} /></button>
        {open && <div className="kebab__list" role="menu"><button role="menuitem" onClick={() => { setOpen(false); onOpen(); }}>View details</button>
          {a.resourceId && <button role="menuitem" onClick={() => { void navigator.clipboard?.writeText(a.resourceId!); setOpen(false); }}>Copy resource ID</button>}
          {a.requestId && <button role="menuitem" onClick={() => { void navigator.clipboard?.writeText(a.requestId!); setOpen(false); }}>Copy request ID</button>}</div>}</div></td>
    </tr>
  );
}

export default function AuditLogs() {
  const [draft, setDraft] = useState<AuditFilters>({ from: daysAgo(30), to: today() });
  const [applied, setApplied] = useState<AuditFilters>(draft);
  const [page, setPage] = useState(0), [size, setSize] = useState(8), [sel, setSel] = useState<AuditLog | null>(null);
  const q = useQuery({ queryKey: ['audit', applied, page, size], queryFn: () => adminAudit({ ...applied, page, size }) });
  const actions = useQuery({ queryKey: ['audit-actions'], queryFn: adminAuditActions, staleTime: 60000 });
  const users = useQuery({ queryKey: ['admin-users', 'all'], queryFn: () => adminUsers({ size: 100 }), staleTime: 60000 });
  const set = (k: keyof AuditFilters, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const reset = () => { const d = { from: daysAgo(30), to: today() }; setDraft(d); setApplied(d); setPage(0); };
  return (
    <>
      <div className="head"><div><h1 className="title">Audit Logs</h1><p className="subtitle">Security and system activity history</p></div>
        <button className="btn btn--primary" onClick={() => download('/admin/audit-logs/export', applied, 'audit-logs.csv')}><Download size={16} /> Export CSV</button></div>
      <div className="card filters">
        <div className="filters__grid">
          <div className="filters__range"><label className="lbl" htmlFor="f1">Date Range</label>
            <div className="range-field"><Calendar size={18} /><input id="f1" type="date" aria-label="From date" value={draft.from ?? ''} onChange={(e) => set('from', e.target.value)} /><ArrowRight size={16} className="muted" /><input type="date" aria-label="To date" value={draft.to ?? ''} onChange={(e) => set('to', e.target.value)} /></div></div>
          <div><label className="lbl" htmlFor="f3">User (Actor)</label><div className="sel-field"><UserIcon size={18} /><select id="f3" value={draft.actor ?? ''} onChange={(e) => set('actor', e.target.value)}><option value="">All Users</option>{users.data?.items.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select><ChevronDown size={16} /></div></div>
          <div><label className="lbl" htmlFor="f4">Action</label><div className="sel-field"><Cog size={18} /><select id="f4" value={draft.action ?? ''} onChange={(e) => set('action', e.target.value)}><option value="">All Actions</option>{actions.data?.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select><ChevronDown size={16} /></div></div>
          <div><label className="lbl" htmlFor="f5">Outcome</label><div className="sel-field"><CheckCircle2 size={18} /><select id="f5" value={draft.outcome ?? ''} onChange={(e) => set('outcome', e.target.value)}><option value="">All Outcomes</option><option>SUCCESS</option><option>FAILURE</option></select><ChevronDown size={16} /></div></div>
          <div><label className="lbl" htmlFor="f6">Resource Type</label><div className="sel-field"><Film size={18} /><select id="f6" value={draft.resourceType ?? ''} onChange={(e) => set('resourceType', e.target.value)}><option value="">All Resources</option>{Object.keys(RESOURCES).map((r) => <option key={r}>{r}</option>)}</select><ChevronDown size={16} /></div></div>
          <div className="filters__rid"><label className="lbl" htmlFor="f7">Resource ID</label><div className="sel-field"><Flag size={18} /><input id="f7" placeholder="Search by resource ID..." value={draft.resourceId ?? ''} onChange={(e) => set('resourceId', e.target.value)} /></div></div>
          <div className="filters__btns"><button className="btn btn--primary" onClick={() => { setApplied(draft); setPage(0); }}>Apply Filters</button><button className="btn btn--ghost" onClick={reset}>Reset</button></div>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Showing {longDate(applied.from)} → {longDate(applied.to)}</div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>{q.isLoading ? <Spinner /> : q.isError ? <ErrorState message="Audit logs could not be loaded." onRetry={() => q.refetch()} /> : !q.data!.items.length ? <Empty title="No audit entries match these filters." /> :
        <div className="tbl-wrap"><table className="tbl tbl--audit"><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th><th>Outcome</th><th>Request ID</th><th>Details</th><th /></tr></thead><tbody>
          {q.data!.items.map((a) => <Row key={a.id} a={a} onOpen={() => setSel(a)} />)}</tbody></table></div>}
        {q.data && <div className="pager" style={{ alignItems: 'center' }}><span className="muted">Showing {q.data.total === 0 ? 0 : page * size + 1} – {Math.min(q.data.total, (page + 1) * size)} of {q.data.total} events</span>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}><label className="muted">Rows per page <select className="input" style={{ width: 76, display: 'inline-block', marginLeft: 8 }} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>{[8, 25, 50].map((n) => <option key={n}>{n}</option>)}</select></label>
            <Pagination page={page} size={size} total={q.data.total} onPage={setPage} label="" /></div></div>}</div>
      {sel && <Modal title="Audit entry" onClose={() => setSel(null)}>
        <dl className="info" style={{ gridTemplateColumns: '130px 1fr' }}><dt>Timestamp</dt><dd>{new Date(sel.createdAt).toLocaleString()}</dd><dt>Actor</dt><dd>{sel.actorName ?? '—'} ({sel.actorEmail ?? '—'})</dd><dt>Action</dt><dd>{sel.actionLabel ?? sel.action}</dd>
          <dt>Resource</dt><dd>{sel.resourceType ?? '—'} {sel.resourceId ?? ''}</dd><dt>Outcome</dt><dd>{sel.outcome}</dd><dt>Request ID</dt><dd>{sel.requestId ?? '—'}</dd><dt>IP address</dt><dd>{sel.ip ?? '—'}</dd><dt>Details</dt><dd>{sel.details ?? '—'}</dd></dl>
        <div className="row-end"><button className="btn btn--ghost" onClick={() => setSel(null)}>Close</button></div></Modal>}
    </>
  );
}
