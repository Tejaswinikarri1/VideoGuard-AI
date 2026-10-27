"""Evidence images: a real frame from the ORIGINAL video near the event, annotated from measured data only."""
import hashlib
from pathlib import Path

import cv2
import numpy as np


def _poly_px(poly, w, h):
    return np.array([[int(x * w), int(y * h)] for x, y in poly], dtype=np.int32)


def make_evidence(video_path: str, out_dir: Path, analysis_id: str, key_seed: str, t: float, bbox, label: str,
                  zone_polygon=None, max_width: int = 960) -> str | None:
    """Returns the storage key '<analysisId>/<file>.jpg' or None on failure (caller records EVIDENCE_GENERATION_FAILED)."""
    cap = cv2.VideoCapture(video_path)
    try:
        if not cap.isOpened():
            return None
        cap.set(cv2.CAP_PROP_POS_MSEC, max(t, 0) * 1000.0)
        ok, frame = cap.read()
        if not ok or frame is None:
            return None
        h, w = frame.shape[:2]
        if zone_polygon:
            overlay = frame.copy()
            cv2.fillPoly(overlay, [_poly_px(zone_polygon, w, h)], (40, 40, 220))
            frame = cv2.addWeighted(overlay, 0.25, frame, 0.75, 0)
            cv2.polylines(frame, [_poly_px(zone_polygon, w, h)], True, (60, 60, 255), 2)
        if bbox is not None:
            x1, y1, x2, y2 = int(bbox[0] * w), int(bbox[1] * h), int(bbox[2] * w), int(bbox[3] * h)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (60, 60, 255), 2)
            cv2.putText(frame, label, (x1, max(14, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        if w > max_width:
            frame = cv2.resize(frame, (max_width, int(h * max_width / w)), interpolation=cv2.INTER_AREA)
        d = out_dir / analysis_id
        d.mkdir(parents=True, exist_ok=True)
        name = hashlib.sha1(key_seed.encode()).hexdigest()[:20] + ".jpg"
        if not cv2.imwrite(str(d / name), frame, [cv2.IMWRITE_JPEG_QUALITY, 85]):
            return None
        return f"{analysis_id}/{name}"
    except Exception:
        return None
    finally:
        cap.release()
