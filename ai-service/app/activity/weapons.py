"""Weapon rule: a weapon-class label must persist over several sampled frames before an event exists.
Works on Detection objects from the primary detector (category 'knife') and the optional weapon checkpoint (category 'weapon')."""
from app.config import Settings
from app.schemas import CandidateEvent

WEAPON_CATEGORIES = {"weapon", "knife"}


def _iou(a, b) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def dedupe_frame(dets: list) -> list:
    """One physical object seen by two models in the same frame must count once: keep the highest-confidence box."""
    kept: list = []
    for d in sorted(dets, key=lambda d: -d.conf):
        if all(not (k.label == d.label and _iou(k.bbox, d.bbox) > 0.5) for k in kept):
            kept.append(d)
    return kept


def detect_weapons(frames: list[tuple[float, list]], s: Settings) -> list[tuple[CandidateEvent, list]]:
    """frames: [(t, [Detection...])] in time order. Returns (event, supporting detections) pairs."""
    per_label: dict[str, list] = {}
    for t, dets in frames:
        for d in dedupe_frame([d for d in dets if d.category in WEAPON_CATEGORIES]):
            per_label.setdefault(d.label, []).append(d)
    out: list[tuple[CandidateEvent, list]] = []
    n = 0
    for label, ds in per_label.items():
        ds.sort(key=lambda d: d.t)
        groups: list[list] = [[ds[0]]]
        for d in ds[1:]:
            if d.t - groups[-1][-1].t <= s.weapon_max_gap_seconds:
                groups[-1].append(d)
            else:
                groups.append([d])
        for g in groups:
            frames = {round(d.t, 3) for d in g}              # DISTINCT sampled frames, not boxes: overlapping boxes must not inflate persistence
            if len(frames) < s.weapon_min_hits:
                continue
            n += 1
            best = max(g, key=lambda d: d.conf)
            mean = sum(d.conf for d in g) / len(g)
            m = {"label": label, "hits": len(frames), "maxConfidence": round(best.conf, 3), "meanConfidence": round(mean, 3)}
            out.append((CandidateEvent("WEAPON_DETECTION", -n, g[0].t, g[-1].t, mean, m,
                                       f"Detected '{label}' in {len(frames)} sampled frames (max confidence {best.conf:.2f})."), g))
    return out
