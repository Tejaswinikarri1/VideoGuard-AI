import numpy as np
from app.config import Settings
from app.schemas import CandidateEvent, Track


def detect_loitering(track: Track, s: Settings) -> list[CandidateEvent]:
    """A person stays within a small area for >= threshold seconds.

    "Small" is measured in BODY HEIGHTS (spread of bbox centres / median bbox height), so a distant person walking slowly is not
    mistaken for a stationary one (a frame-fraction threshold would be). People shorter than minPersonHeight of the frame are
    skipped: their displacement cannot be measured reliably. Spread = diagonal of the bounding box of the bbox centres."""
    if track.class_name != "person":
        return []
    obs = [o for o in sorted(track.observations, key=lambda o: o.t)
           if o.conf >= s.min_detection_confidence and (o.bbox[3] - o.bbox[1]) >= s.min_person_height]
    n = len(obs)
    if n < s.min_track_observations:
        return []
    pts = np.array([o.center for o in obs])
    hs = np.array([o.bbox[3] - o.bbox[1] for o in obs])

    def spread_bh(i: int, j: int) -> float:
        seg = pts[i:j + 1]
        return float(np.hypot(*(seg.max(axis=0) - seg.min(axis=0))) / max(np.median(hs[i:j + 1]), 1e-6))

    events: list[CandidateEvent] = []
    i = 0
    while i < n:
        j = i
        while j + 1 < n and spread_bh(i, j + 1) <= s.loitering_max_movement:
            j += 1
        duration = obs[j].t - obs[i].t
        count = j - i + 1
        if duration >= s.loitering_threshold_seconds and count >= s.min_track_observations:
            mean_conf = float(np.mean([o.conf for o in obs[i:j + 1]]))
            sp = spread_bh(i, j)
            events.append(CandidateEvent(
                "PERSON_LOITERING", track.track_id, obs[i].t, obs[j].t, mean_conf,
                {"durationSeconds": round(duration, 2), "spreadBodyHeights": round(sp, 3), "observationCount": count, "meanConfidence": round(mean_conf, 3)},
                f"Tracked person remained within a small area for approximately {duration:.1f} seconds."))
            i = j + 1
        else:
            i += 1
    return events
