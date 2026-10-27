import type { ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleHelp, Maximize2, X } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/client';
import { eventReviews, submitReview } from '../api/endpoints';
import type { EventItem, ReviewStatus } from '../api/types';
import { clock, dateTime, EVENT_LABEL, pct } from '../fmt';
import { mediaUrl, MediaImg, useMediaToken } from './media';
import { EventIcon } from './EventIcon';
import { Modal, ReviewBadge, SeverityBadge } from './ui';

const OPTIONS: { v: Exclude<ReviewStatus, 'PENDING'>; label: string; sub: string; icon: ReactElement; cls: string }[] = [
  { v: 'CONFIRMED', label: 'CONFIRM', sub: 'True positive event', icon: <Check size={18} />, cls: 'decide--ok' },
  { v: 'REJECTED', label: 'REJECT', sub: 'False positive', icon: <X size={18} />, cls: 'decide--no' },
  { v: 'UNCERTAIN', label: 'UNCERTAIN', sub: 'Not enough evidence', icon: <CircleHelp size={18} />, cls: 'decide--maybe' },
];

export function ReviewDialog({ event, onClose, onDone }: { event: EventItem; onClose: () => void; onDone?: (e: EventItem) => void }) {
  const qc = useQueryClient();
  const [decision, setDecision] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const history = useQuery({ queryKey: ['reviews', event.id], queryFn: () => eventReviews(event.id) });
  const ev = useMediaToken('evidence', event.hasEvidence ? event.id : null);
  const m = useMutation({
    mutationFn: () => submitReview(event.id, decision as string, notes),
    onSuccess: (e) => { qc.invalidateQueries(); onDone?.(e); onClose(); },
  });
  return (
    <Modal title="Review Event" onClose={onClose} wide>
      <div className="review">
        <div className="review__img">
          {event.hasEvidence ? <MediaImg kind="evidence" id={event.id} alt="Evidence frame" /> : <div className="img-ph" style={{ height: 220 }}>Evidence image unavailable{event.evidenceStatus === 'FAILED' ? ' (generation failed)' : ''}</div>}
          {ev.data && <a className="btn btn--ghost" href={mediaUrl(ev.data)} target="_blank" rel="noreferrer"><Maximize2 size={14} /> Open Full Size</a>}
        </div>
        <div className="review__side"><EventIcon type={event.eventType} size={52} />
        <dl className="review__facts">
          <dt>Event Type</dt><dd>{EVENT_LABEL[event.eventType] ?? event.eventType}</dd>
          <dt>Timestamp</dt><dd>{clock(event.startTimeSeconds)} – {clock(event.endTimeSeconds)}</dd>
          <dt>Confidence</dt><dd>{pct(event.confidence)}</dd>
          <dt>Severity</dt><dd><SeverityBadge s={event.severity} /></dd>
          <dt>Current Status</dt><dd><ReviewBadge s={event.reviewStatus} /></dd>
          <dt className="full">Explanation</dt><dd className="full">{event.description}</dd>
        </dl></div>
      </div>
      <h3 className="req">Review Decision</h3>
      <div className="decide" role="radiogroup" aria-label="Review decision">
        {OPTIONS.map((o) => <button key={o.v} role="radio" aria-checked={decision === o.v} className={`decide__opt ${o.cls} ${decision === o.v ? 'on' : ''}`} onClick={() => setDecision(o.v)}>{o.icon}<span><b>{o.label}</b><small>{o.sub}</small></span></button>)}
      </div>
      <label className="lbl" htmlFor="notes">Reviewer Notes (optional)</label>
      <textarea id="notes" className="input" rows={3} maxLength={500} placeholder="Add review notes (optional)..." value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="muted right">{notes.length} / 500</div>
      {m.isError && <div className="form-error" role="alert">{errorMessage(m.error)}</div>}
      {!!history.data?.length && <details className="hist"><summary>Review history ({history.data.length})</summary>{history.data.map((r) => <div key={r.id}><ReviewBadge s={r.decision} /> <b>{r.reviewerName}</b> · {dateTime(r.createdAt)}{r.notes && <div className="muted">{r.notes}</div>}</div>)}</details>}
      <div className="row-end"><button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={!decision || m.isPending} onClick={() => m.mutate()}>{m.isPending ? 'Submitting…' : 'Submit Review'}</button></div>
    </Modal>
  );
}
