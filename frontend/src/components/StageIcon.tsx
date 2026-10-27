import { Activity, Camera, Crosshair, Database, GitMerge, Layers, Settings, Waypoints, type LucideIcon } from 'lucide-react';

const M: Record<string, [LucideIcon, string]> = {
  FRAME_SAMPLING: [Layers, '#0b63f6'], OBJECT_DETECTION: [Crosshair, '#2f8cff'], OBJECT_TRACKING: [Waypoints, '#8b5cf6'], ACTIVITY_ANALYSIS: [Activity, '#f5a524'],
  EVENT_CORRELATION: [GitMerge, '#06b6d4'], EVIDENCE_GENERATION: [Camera, '#17b26a'], PERSISTING_RESULTS: [Database, '#2f8cff'],
};
export function StageIcon({ stage, size = 28 }: { stage: string; size?: number }) {
  const [I, c] = M[stage] ?? [Settings, '#8fa6d1'];
  return <span className="evicon" style={{ width: size, height: size, borderRadius: 8, background: `${c}26`, color: c, borderColor: `${c}55` }}><I size={size * 0.56} /></span>;
}
