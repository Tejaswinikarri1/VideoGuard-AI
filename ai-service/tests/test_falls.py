import dataclasses
import math
import shutil
import subprocess
from pathlib import Path

import pytest

from app.activity.falls import detect_falls
from app.config import Settings
from app.detection.pose_detector import PoseDet, torso_angle_deg
from app.detection.yolo_detector import Detection
from app.pipeline.runner import run_pipeline
from app.pipeline.state import JobState
from app.schemas import Observation, Track
from tests.doubles import GreedyIouTracker

S = dataclasses.replace(Settings(), min_track_observations=4)


def track(seq, conf=0.9):
    """seq: [(t, angle)] -> person track with torso angles."""
    return Track(1, "person", [Observation(t, (0.4, 0.3, 0.5, 0.7), conf, a) for t, a in seq])


def test_upright_then_lying_is_a_fall_with_measurements():
    seq = [(i * 0.2, 5.0) for i in range(10)] + [(2.0, 40.0), (2.2, 75.0)] + [(2.2 + i * 0.2, 80.0) for i in range(1, 20)]
    ev = detect_falls(track(seq), S)
    assert len(ev) == 1 and ev[0].event_type == "FALL_DETECTED" and ev[0].review_status == "PENDING"
    assert ev[0].measurements["lyingSeconds"] >= S.fall_lying_seconds and ev[0].measurements["transitionSeconds"] <= S.fall_transition_seconds
    assert "lying posture" in ev[0].description and "suspicious" not in ev[0].description.lower()


def test_slow_lowering_brief_lying_and_no_pose_are_not_falls():
    slow = [(i * 0.2, 5.0) for i in range(10)] + [(2.0 + i * 1.0, 30 + i * 12) for i in range(8)]            # takes many seconds
    assert detect_falls(track(slow), S) == []
    brief = [(i * 0.2, 5.0) for i in range(10)] + [(2.0, 80.0), (2.2, 80.0), (2.4, 5.0)] + [(2.6 + i * 0.2, 5.0) for i in range(8)]
    assert detect_falls(track(brief), S) == []                                                               # got straight back up
    nopose = Track(1, "person", [Observation(i * 0.2, (0.4, 0.3, 0.5, 0.7), 0.9, None) for i in range(40)])
    assert detect_falls(nopose, S) == []
    always_lying = [(i * 0.2, 85.0) for i in range(40)]
    assert detect_falls(track(always_lying), S) == []                                                        # was never upright -> no transition seen


def test_torso_angle_geometry_and_missing_keypoints():
    def kp(sho, hip, vis=1.0):
        k = [(0.0, 0.0, 0.0)] * 17
        k[5], k[6], k[11], k[12] = (sho[0] - .02, sho[1], vis), (sho[0] + .02, sho[1], vis), (hip[0] - .02, hip[1], vis), (hip[0] + .02, hip[1], vis)
        return tuple(k)
    assert torso_angle_deg(kp((0.5, 0.3), (0.5, 0.6))) == pytest.approx(0.0, abs=1e-6)
    assert torso_angle_deg(kp((0.3, 0.5), (0.6, 0.5))) == pytest.approx(90.0, abs=1e-6)
    assert torso_angle_deg(kp((0.5, 0.3), (0.5, 0.6), vis=0.1)) is None


# ---- pipeline with scripted posture over a real (generated) video ----
pytestmark_ff = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


class FallDetector:
    def detect(self, frame, t):
        if t < 3.0:  box = (0.45, 0.30, 0.55, 0.70)
        elif t < 4.2:  # gradual descent keeps boxes overlapping so the tracker keeps ONE track
            f = (t - 3.0) / 1.2; box = (0.45 - 0.08 * f, 0.30 + 0.25 * f, 0.55 + 0.08 * f, 0.70)
        else: box = (0.37, 0.55, 0.63, 0.70)
        return [Detection(t, "person", "person", 0.9, box)]


class FallPose:
    def detect(self, frame, t):
        box = FallDetector().detect(frame, t)[0].bbox
        ang = 3.0 if t < 3.0 else (45.0 if t < 4.2 else 82.0)
        cx, cy, L = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, 0.15
        dx, dy = math.sin(math.radians(ang)) * L, math.cos(math.radians(ang)) * L
        k = [(0.0, 0.0, 0.0)] * 17
        k[5], k[6], k[11], k[12] = (cx - dx - .01, cy - dy, 1.0), (cx - dx + .01, cy - dy, 1.0), (cx + dx - .01, cy + dy, 1.0), (cx + dx + .01, cy + dy, 1.0)
        return [PoseDet(t, box, 0.9, tuple(k))]


@pytestmark_ff
def test_pipeline_reports_fall_with_evidence(tmp_path):
    v = tmp_path / "v.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=10", "-pix_fmt", "yuv420p", str(v)], check=True)
    s = dataclasses.replace(Settings(), sampling_fps=5, pose_enabled=True)
    res = run_pipeline("job-fall-0001", str(v), [], s, FallDetector(), None, lambda fps: GreedyIouTracker(), JobState("job-fall-0001"), tmp_path / "ev", "test", FallPose())
    falls = [e for e in res["events"] if e["eventType"] == "FALL_DETECTED"]
    assert len(falls) == 1 and falls[0]["reviewStatus"] == "PENDING" and falls[0]["evidenceKey"]
    assert 2.5 <= falls[0]["startTimeSeconds"] <= 3.6 and falls[0]["severity"] in ("LOW", "MEDIUM", "HIGH")
    # without a pose model the fall rule must stay silent
    res2 = run_pipeline("job-fall-0002", str(v), [], dataclasses.replace(s, pose_enabled=False), FallDetector(), None, lambda fps: GreedyIouTracker(), JobState("job-fall-0002"), tmp_path / "ev", "test", None)
    assert all(e["eventType"] != "FALL_DETECTED" for e in res2["events"])
