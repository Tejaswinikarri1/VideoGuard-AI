from app.schemas import Observation, Track


def make_track(points, class_name="person", conf=0.9, half=0.06, tid=1):
    """points: [(t, cx, cy)] -> Track with small boxes centred on (cx, cy)."""
    return Track(tid, class_name, [Observation(t, (cx - half, cy - half, cx + half, cy + half), conf) for t, cx, cy in points])
