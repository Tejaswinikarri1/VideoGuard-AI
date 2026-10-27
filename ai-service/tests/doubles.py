"""Test doubles. NOT used in production code paths."""
from dataclasses import dataclass

from app.detection.yolo_detector import Detection
from app.pipeline.tracker import TrackedDetection


class ScriptedDetector:
    """Returns detections derived from the frame timestamp (a script), regardless of pixels."""
    def detect(self, frame, t):
        out = []
        if t <= 10.0:   # stationary person standing inside the zone
            out.append(Detection(t, "person", "person", 0.9, (0.25, 0.35, 0.35, 0.45)))
        if 3.0 <= t <= 5.0:  # person sprinting across the lower part of the frame
            x = 0.05 + (t - 3.0) * 0.45
            out.append(Detection(t, "person", "person", 0.88, (x, 0.75, x + 0.2, 0.9)))
        if 2.0 <= t <= 3.2:  # knife label seen over several frames
            out.append(Detection(t, "knife", "knife", 0.7, (0.6, 0.5, 0.66, 0.56)))
        return out


def _iou(a, b):
    ix, iy = max(0, min(a[2], b[2]) - max(a[0], b[0])), max(0, min(a[3], b[3]) - max(a[1], b[1]))
    i = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
    return i / u if u else 0


class GreedyIouTracker:
    def __init__(self):
        self.next_id, self.last = 1, {}

    def update(self, detections, w, h):
        out, used = [], set()
        for d in [d for d in detections if d.category in ("person", "vehicle")]:
            best = max(((tid, _iou(d.bbox, bb)) for tid, bb in self.last.items() if tid not in used), key=lambda x: x[1], default=(None, 0))
            if best[0] is not None and best[1] > 0.2:
                tid = best[0]
            else:
                tid, self.next_id = self.next_id, self.next_id + 1
            used.add(tid)
            self.last[tid] = d.bbox
            out.append(TrackedDetection(tid, d.category, d.conf, d.bbox))
        return out
