import numpy as np
from app.config import Settings
from app.schemas import CandidateEvent, Track


def _smooth(a: np.ndarray, w: int) -> np.ndarray:
    if w <= 1 or len(a) < w:
        return a
    k = np.ones(w) / w
    pad = w // 2
    padded = np.pad(a, ((pad, w - 1 - pad), (0, 0)), mode="edge")
    return np.stack([np.convolve(padded[:, c], k, mode="valid") for c in range(a.shape[1])], axis=1)


def detect_running(track: Track, s: Settings) -> list[CandidateEvent]:
    """Sustained speed above a threshold, measured in BODY HEIGHTS PER SECOND (centre displacement / person height / elapsed time).
    This is distance-independent but is NOT real-world speed: it assumes the person is roughly upright and the camera is not overhead.
    Uses real timestamps (sampling-rate aware), smoothing, and requires the speed to hold for >= runningWindowSeconds."""
    if track.class_name != "person":
        return []
    obs = [o for o in sorted(track.observations, key=lambda o: o.t)
           if o.conf >= s.min_detection_confidence and (o.bbox[3] - o.bbox[1]) >= s.min_person_height]
    if len(obs) < max(s.min_track_observations, 3):
        return []
    t = np.array([o.t for o in obs])
    c = _smooth(np.array([[*o.center, o.bbox[3] - o.bbox[1]] for o in obs]), s.motion_smoothing_window)
    dt = np.diff(t)
    dist = np.hypot(*np.diff(c[:, :2], axis=0).T)
    height = (c[1:, 2] + c[:-1, 2]) / 2
    speed = np.where(dt > 0, dist / np.maximum(height, 1e-6) / np.where(dt > 0, dt, 1), 0.0)  # body heights / second
    fast = speed >= s.running_speed_threshold
    events: list[CandidateEvent] = []
    k = 0
    while k < len(fast):
        if not fast[k]:
            k += 1
            continue
        m = k
        while m + 1 < len(fast) and fast[m + 1]:
            m += 1
        start, end = t[k], t[m + 1]
        npts = m - k + 2
        if end - start >= s.running_window_seconds and npts >= s.min_track_observations:
            seg = speed[k:m + 1]
            conf = float(np.mean([o.conf for o in obs[k:m + 2]]))
            events.append(CandidateEvent(
                "SUDDEN_RUNNING", track.track_id, float(start), float(end), conf,
                {"durationSeconds": round(float(end - start), 2), "peakSpeedBodyHeightsPerSec": round(float(seg.max()), 2),
                 "meanSpeedBodyHeightsPerSec": round(float(seg.mean()), 2), "observationCount": npts},
                f"Tracked person moved at about {seg.mean():.1f} body-heights per second for approximately {end - start:.1f} seconds "
                f"(relative to body size, not a real-world speed)."))
        k = m + 1
    return events
