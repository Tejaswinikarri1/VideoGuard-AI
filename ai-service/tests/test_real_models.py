"""Real-model tests: real YOLOv8n weights, real ByteTrack, a real photo (Ultralytics' public bus.jpg).
Skipped automatically when the ML stack, weights or the sample image are unavailable.
NOTE: motion in these clips is synthetic (a still photo panned/held). They verify integration, NOT detection accuracy."""
import dataclasses
import urllib.request
from pathlib import Path

import cv2
import numpy as np
import pytest

pytest.importorskip("torch")
pytest.importorskip("ultralytics")
WEIGHTS = Path("models/yolov8n.pt")
BUS = Path("tests/_assets/bus.jpg")
pytestmark = pytest.mark.skipif(not WEIGHTS.exists(), reason="run scripts/setup_models.py first")

from app.config import Settings  # noqa: E402
from app.detection.yolo_detector import YoloDetector  # noqa: E402
from app.pipeline.runner import run_pipeline  # noqa: E402
from app.pipeline.state import JobState  # noqa: E402
from app.pipeline.tracker import ByteTrackAdapter  # noqa: E402


@pytest.fixture(scope="session")
def bus():
    if not BUS.exists():
        BUS.parent.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve("https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg", BUS)
        except Exception:
            pytest.skip("sample image not downloadable")
    return cv2.imread(str(BUS))


@pytest.fixture(scope="session")
def detector():
    d = YoloDetector(str(WEIGHTS), "cpu", 640, 0.25)
    d.load()
    return d


def make_video(path: Path, img, seconds: float, fps: int, dx_per_frame: float):
    h, w = img.shape[:2]
    vw = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for i in range(int(seconds * fps)):
        M = np.float32([[1, 0, i * dx_per_frame], [0, 1, 0]])
        vw.write(cv2.warpAffine(img, M, (w, h), borderMode=cv2.BORDER_REPLICATE))
    vw.release()


def run(tmp_path, video, zones, detector):
    s = dataclasses.replace(Settings(), sampling_fps=5, loitering_threshold_seconds=8)
    st = JobState("job-real-0001")
    ev = tmp_path / "evidence"
    res = run_pipeline("job-real-0001", str(video), zones, s, detector, None, lambda fps: ByteTrackAdapter(fps), st, ev, "yolov8n-test")
    return res, st, ev


def test_class_labels_come_from_the_checkpoint(detector):
    assert len(detector.names) == 80 and detector.names[0] == "person"
    assert "knife" in detector.names.values() and "gun" not in detector.names.values()
    assert detector.resolution.unsupported_categories == []


def test_detects_real_people_and_bus(detector, bus):
    dets = detector.detect(bus, 0.0)
    persons = [d for d in dets if d.category == "person" and d.conf >= 0.5]
    assert len(persons) >= 3 and any(d.category == "vehicle" and d.label == "bus" for d in dets)
    assert all(0 <= v <= 1 for d in dets for v in d.bbox)


def test_bytetrack_keeps_ids_stable_while_scene_moves(detector, bus, tmp_path):
    v = tmp_path / "pan.mp4"
    make_video(v, bus, 8, 10, 3)
    res, st, _ = run(tmp_path, v, [], detector)
    long_person_tracks = [t for t in res["tracksSummary"] if t["className"] == "person" and t["observationCount"] >= 35]
    assert len(long_person_tracks) >= 2          # same IDs across all 40 sampled frames
    assert all(e["reviewStatus"] == "PENDING" for e in res["events"])
    assert res["events"] == [] or all(e["eventType"] != "SUDDEN_RUNNING" for e in res["events"])  # slow pan is not running


def test_loitering_and_intrusion_on_real_detections(detector, bus, tmp_path):
    v = tmp_path / "static.mp4"
    make_video(v, bus, 12, 10, 0)                      # real people, held still for 12 s
    zone = {"id": "z1", "name": "Left side", "polygon": [[0.0, 0.4], [0.5, 0.4], [0.5, 1.0], [0.0, 1.0]], "enabled": True}
    res, st, ev = run(tmp_path, v, [zone], detector)
    kinds = {e["eventType"] for e in res["events"]}
    assert "PERSON_LOITERING" in kinds and "RESTRICTED_AREA_INTRUSION" in kinds
    for e in res["events"]:
        assert e["reviewStatus"] == "PENDING" and e["evidenceKey"]
        assert cv2.imread(str(ev / e["evidenceKey"])) is not None


POSE = Path("models/yolov8n-pose.pt")


@pytest.mark.skipif(not POSE.exists(), reason="run scripts/download_weights.py --pose")
def test_real_pose_model_gives_upright_then_lying_angles(bus):
    from app.detection.pose_detector import YoloPoseDetector
    p = YoloPoseDetector(str(POSE), "cpu", 640, 0.4)
    p.load()
    standing = [d.torso_angle for d in p.detect(bus, 0.0) if d.torso_angle is not None]
    assert len(standing) >= 3 and all(a < 15 for a in standing)             # real standing people are near vertical
    lying = [d.torso_angle for d in p.detect(cv2.rotate(bus, cv2.ROTATE_90_CLOCKWISE), 0.0) if d.torso_angle is not None]
    assert lying and max(lying) > 60                                         # same photo rotated: people lying sideways
