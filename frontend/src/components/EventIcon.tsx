import { ArrowDownToLine, Footprints, PersonStanding, ShieldAlert, TriangleAlert, type LucideIcon } from 'lucide-react';
import { EVENT_COLOR } from '../fmt';

const ICONS: Record<string, LucideIcon> = { SUDDEN_RUNNING: Footprints, RESTRICTED_AREA_INTRUSION: TriangleAlert, PERSON_LOITERING: PersonStanding, WEAPON_DETECTION: ShieldAlert, FALL_DETECTED: ArrowDownToLine };
const TILE: Record<string, string> = { SUDDEN_RUNNING: '#ef4a5a', RESTRICTED_AREA_INTRUSION: '#f5a524', PERSON_LOITERING: '#17b26a', WEAPON_DETECTION: '#ef3b4a', FALL_DETECTED: '#8b5cf6' };

/** Coloured icon tile per event type (as in the mockups' event lists). */
export function EventIcon({ type, size = 40, round = false }: { type: string; size?: number; round?: boolean }) {
  const I = ICONS[type] ?? TriangleAlert;
  const c = TILE[type] ?? EVENT_COLOR[type] ?? '#2f8cff';
  return <span className="evicon" style={{ width: size, height: size, borderRadius: round ? '50%' : 10, background: `${c}26`, color: c, borderColor: `${c}66` }}><I size={size * 0.5} /></span>;
}
