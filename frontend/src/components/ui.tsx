import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, X, XCircle, Settings as Cog } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { Analysis, ReviewStatus, Severity, Video } from '../api/types';

export function Spinner({ label = 'Loading…' }: { label?: string }) { return <div className="state" role="status"><Loader2 className="spin" size={22} /> {label}</div>; }
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="state state--err" role="alert"><AlertTriangle size={22} /> {message}{onRetry && <button className="btn btn--ghost" onClick={onRetry}>Retry</button>}</div>;
}
export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return <div className="state"><div><b>{title}</b>{hint && <div className="muted">{hint}</div>}</div>{action}</div>;
}

export function SeverityBadge({ s }: { s: Severity }) { return <span className={`badge sev-${s.toLowerCase()}`}>{s}</span>; }
const RS: Record<ReviewStatus, string> = { PENDING: 'rs-pending', CONFIRMED: 'rs-confirmed', REJECTED: 'rs-rejected', UNCERTAIN: 'rs-uncertain' };
export function ReviewBadge({ s }: { s: ReviewStatus }) {
  const icon = s === 'CONFIRMED' ? <CheckCircle2 size={12} /> : s === 'REJECTED' ? <XCircle size={12} /> : s === 'PENDING' ? <Clock size={12} /> : <AlertTriangle size={12} />;
  return <span className={`badge ${RS[s]}`}>{icon}{s}</span>; // icon + text: status never relies on color alone
}

export type StatusKind = 'completed' | 'processing' | 'failed' | 'cancelled' | 'neutral';
export function analysisStatus(st?: string | null, meta?: string): { kind: StatusKind; label: string } {
  if (st === 'COMPLETED') return { kind: 'completed', label: 'Completed' };
  if (st === 'RUNNING' || st === 'QUEUED') return { kind: 'processing', label: 'Processing' };
  if (st === 'FAILED') return { kind: 'failed', label: 'Failed' };
  if (st === 'CANCELLED') return { kind: 'cancelled', label: 'Cancelled' };
  if (meta === 'FAILED') return { kind: 'failed', label: 'Metadata failed' };
  return { kind: 'neutral', label: 'Not analyzed' };
}
export function StatusBadge({ st, meta }: { st?: string | null; meta?: string }) {
  const { kind, label } = analysisStatus(st, meta);
  const icon = kind === 'completed' ? <CheckCircle2 size={14} /> : kind === 'processing' ? <Cog size={14} className="spin-slow" /> : kind === 'failed' ? <AlertTriangle size={14} /> : <Clock size={14} />;
  return <span className={`status status--${kind}`}>{icon}{label}</span>;
}
export const videoStatus = (v: Video) => <StatusBadge st={v.latestAnalysisStatus} meta={v.metadataStatus} />;
export const jobStatus = (a: Analysis) => <StatusBadge st={a.status} />;

export function Pagination({ page, size, total, onPage, label = 'items' }: { page: number; size: number; total: number; onPage: (p: number) => void; label?: string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : page * size + 1, to = Math.min(total, (page + 1) * size);
  const start = Math.max(0, Math.min(page - 2, pages - 5));
  const nums = Array.from({ length: Math.min(pages, 5) }, (_, i) => start + i);
  const showTail = pages > 5 && nums[nums.length - 1] < pages - 1;
  return (
    <div className="pager">
      <span className="muted">Showing {from} to {to} of {total} {label}</span>
      <div className="pager__btns">
        <button aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={16} /></button>
        {nums.map((n) => <button key={n} aria-current={n === page ? 'page' : undefined} className={n === page ? 'on' : ''} onClick={() => onPage(n)}>{n + 1}</button>)}
        {showTail && <><span className="muted" aria-hidden>…</span><button aria-current={page === pages - 1 ? 'page' : undefined} className={page === pages - 1 ? 'on' : ''} onClick={() => onPage(pages - 1)}>{pages}</button></>}
        <button aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head"><h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmLabel, danger, busy, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>{message}</p>
      <div className="row-end"><button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className={`btn ${danger ? 'btn--danger-solid' : 'btn--primary'}`} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button></div>
    </Modal>
  );
}
