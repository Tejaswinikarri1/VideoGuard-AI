"""Tracking interface and the ByteTrack adapter.

ByteTrackAdapter wraps Ultralytics' BYTETracker (the maintained ByteTrack implementation) and is exercised against
Ultralytics 8.4 with real detections in tests/test_real_models.py."""
import inspect
from dataclasses import dataclass
from types import SimpleNamespace
from typing import Protocol

import numpy as np

TRACKED_CATEGORIES = ("person", "vehicle")
_CAT_INDEX = {c: i for i, c in enumerate(TRACKED_CATEGORIES)}


@dataclass(frozen=True)
class TrackedDetection:
    track_id: int
    category: str
    conf: float
    bbox: tuple[float, float, float, float]  # normalized


class Tracker(Protocol):
    def update(self, detections: list, frame_w: int, frame_h: int) -> list[TrackedDetection]: ...


class ByteTrackAdapter:
    """One instance per analysis, so tracking state never leaks between videos."""

    def __init__(self, frame_rate: float, high=0.25, low=0.1, new=0.25, buffer_seconds=3.0, match=0.8):
        from ultralytics.trackers.byte_tracker import BYTETracker  # lazy: needs torch
        fps = max(1.0, float(frame_rate))
        # `track_buffer` counts SAMPLED frames: keep lost tracks ~buffer_seconds (handles brief occlusions at any sampling rate).
        args = SimpleNamespace(track_high_thresh=high, track_low_thresh=low, new_track_thresh=new,
                               track_buffer=max(5, int(round(fps * buffer_seconds))), match_thresh=match, fuse_score=True)
        # Ultralytics <= 8.3 took (args, frame_rate); >= 8.4 takes only (args).
        if "frame_rate" in inspect.signature(BYTETracker.__init__).parameters:
            self._t = BYTETracker(args, frame_rate=max(1, int(round(fps))))
        else:
            self._t = BYTETracker(args)

    def update(self, detections: list, frame_w: int, frame_h: int) -> list[TrackedDetection]:
        dets = [d for d in detections if d.category in _CAT_INDEX]
        xywh = np.zeros((len(dets), 4), dtype=np.float32)
        for i, d in enumerate(dets):
            x1, y1, x2, y2 = d.bbox[0] * frame_w, d.bbox[1] * frame_h, d.bbox[2] * frame_w, d.bbox[3] * frame_h
            xywh[i] = [(x1 + x2) / 2, (y1 + y2) / 2, x2 - x1, y2 - y1]
        shim = _Dets(conf=np.array([d.conf for d in dets], dtype=np.float32), xywh=xywh,
                     cls=np.array([_CAT_INDEX[d.category] for d in dets], dtype=np.float32))
        out = self._t.update(shim)  # rows: x1,y1,x2,y2,track_id,score,cls,det_idx
        return [TrackedDetection(int(r[4]), TRACKED_CATEGORIES[int(r[6])], float(r[5]),
                                 (float(r[0]) / frame_w, float(r[1]) / frame_h, float(r[2]) / frame_w, float(r[3]) / frame_h)) for r in out]


class _Dets:
    """NumPy-backed detections exposing conf/cls/xywh and supporting boolean indexing, as BYTETracker expects."""

    def __init__(self, conf, xywh, cls):
        self.conf, self.xywh, self.cls = conf, xywh, cls

    def __len__(self):
        return len(self.conf)

    def __getitem__(self, idx):
        return _Dets(self.conf[idx], self.xywh[idx], self.cls[idx])

    @property
    def xyxy(self):
        c = self.xywh
        return np.stack([c[:, 0] - c[:, 2] / 2, c[:, 1] - c[:, 3] / 2, c[:, 0] + c[:, 2] / 2, c[:, 1] + c[:, 3] / 2], axis=1) if len(c) else c
