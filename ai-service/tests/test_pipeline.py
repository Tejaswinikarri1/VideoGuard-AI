import dataclasses
import shutil
import subprocess
import time
from pathlib import Path

import cv2
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.jobs import JobManager
from app.pipeline.runner import AnalysisError, correlate, run_pipeline
from app.pipeline.state import Cancelled, JobState
from app.schemas import CandidateEvent
from tests.doubles import GreedyIouTracker, ScriptedDetector

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
ZONE = {"id": "z1", "name": "Server room", "polygon": [[0.1, 0.3], [0.5, 0.3], [0.5, 0.7], [0.1, 0.7]], "enabled": True}
STAGES = ["PREPARING_VIDEO", "FRAME_SAMPLING", "OBJECT_DETECTION", "OBJECT_TRACKING", "ACTIVITY_ANALYSIS", "EVENT_CORRELATION",
          "EVIDENCE_GENERATION", "PERSISTING_RESULTS"]


@pytest.fixture(scope="module")
def env(tmp_path_factory):
    root = tmp_path_factory.mktemp("store")
    (root / "videos").mkdir()
    (root / "evidence").mkdir()
    v = root / "videos" / "sample.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=12", "-pix_fmt", "yuv420p", str(v)], check=True)
    s = dataclasses.replace(Settings(), sampling_fps=5, video_root=str(root / "videos"), evidence_root=str(root / "evidence"),
                            service_token="x" * 32, loitering_threshold_seconds=8, running_speed_threshold=2.2)
    return root, v, s


class RecordingState(JobState):
    def __init__(self, *a):
        super().__init__(*a)
        self.history = []

    def begin(self, stage, base):
        super().begin(stage, base)
        self.history.append(self.progress)

    def advance(self, f, base, span):
        super().advance(f, base, span)
        self.history.append(self.progress)


def run(env, zones=(ZONE,), state=None):
    root, v, s = env
    st = state or RecordingState("job-12345678")
    res = run_pipeline("job-12345678", str(v), list(zones), s, ScriptedDetector(), None, lambda fps: GreedyIouTracker(), st, root / "evidence", "test-model")
    return res, st


def test_pipeline_produces_all_event_types_pending_with_evidence(env):
    root, _, _ = env
    res, st = run(env)
    types = {e["eventType"] for e in res["events"]}
    assert types == {"PERSON_LOITERING", "SUDDEN_RUNNING", "RESTRICTED_AREA_INTRUSION", "WEAPON_DETECTION"}
    for e in res["events"]:
        assert e["reviewStatus"] == "PENDING" and e["severity"] in ("LOW", "MEDIUM", "HIGH")
        assert 0 <= e["confidence"] <= 1 and e["endTimeSeconds"] >= e["startTimeSeconds"]
        assert not any(w in e["description"].lower() for w in ("suspicious", "criminal", "intent", "m/s"))
        assert e["evidenceKey"] and cv2.imread(str(root / "evidence" / e["evidenceKey"])) is not None
        assert e["trajectory"]
    assert not (root / "evidence" / "_tmp" / "job-12345678").exists()  # temp frames cleaned up


def test_real_stages_in_order_and_progress_monotonic(env):
    _, st = run(env)
    assert [s["stage"] for s in st.stages] == STAGES
    assert all(a <= b for a, b in zip(st.history, st.history[1:]))
    assert any("frames extracted" in l for l in st.snapshot()["logs"])


def test_intrusion_only_with_valid_zone(env):
    res, _ = run(env, zones=())
    assert "RESTRICTED_AREA_INTRUSION" not in {e["eventType"] for e in res["events"]}


def test_ground_truth_timing(env):
    res, _ = run(env)
    run_ev = next(e for e in res["events"] if e["eventType"] == "SUDDEN_RUNNING")
    assert 2.8 <= run_ev["startTimeSeconds"] <= 3.6 and run_ev["endTimeSeconds"] <= 5.2
    weapon = next(e for e in res["events"] if e["eventType"] == "WEAPON_DETECTION")
    assert weapon["measurements"]["label"] == "knife" and weapon["measurements"]["hits"] >= 3
    loiter = next(e for e in res["events"] if e["eventType"] == "PERSON_LOITERING")
    assert loiter["measurements"]["durationSeconds"] >= 8


def test_cancel_and_failures(env, tmp_path):
    st = JobState("job-12345678")
    st.cancel.set()
    with pytest.raises(Cancelled):
        run(env, state=st)
    bad = tmp_path / "bad.mp4"
    bad.write_text("not a video")
    root, _, s = env
    with pytest.raises(AnalysisError) as e:
        run_pipeline("job-bad00000", str(bad), [], s, ScriptedDetector(), None, lambda f: GreedyIouTracker(), JobState("job-bad00000"), root / "evidence", "m")
    assert e.value.code == "VIDEO_METADATA_FAILED"


def test_correlate_merges_same_track_but_not_across_tracks():
    mk = lambda tid, a, b: CandidateEvent("SUDDEN_RUNNING", tid, a, b, 0.8, {}, "d")
    assert len(correlate([mk(1, 0, 2), mk(1, 2.5, 4)])) == 1
    assert len(correlate([mk(1, 0, 2), mk(2, 0, 2)])) == 2


def test_job_api_end_to_end(env, monkeypatch):
    import app.main as m
    root, _, s = env
    monkeypatch.setattr(m, "settings", s)
    monkeypatch.setattr(m, "_jobs", JobManager(s, ScriptedDetector(), None, lambda fps: GreedyIouTracker(), "test-model"))
    c = TestClient(m.app)  # no lifespan: models are not loaded
    body = {"jobId": "job-api-0001", "videoKey": "sample.mp4", "zones": [ZONE]}
    assert c.post("/v1/jobs", json=body).status_code == 401
    assert c.post("/v1/jobs", json=body, headers={"X-Service-Token": "wrong"}).status_code == 401
    H = {"X-Service-Token": s.service_token}
    assert c.post("/v1/jobs", json=body, headers=H).status_code == 202
    assert c.post("/v1/jobs", json=body, headers=H).status_code == 202  # idempotent resubmission
    seen, deadline = [], time.time() + 90
    while time.time() < deadline:
        snap = c.get("/v1/jobs/job-api-0001", headers=H).json()
        seen.append(snap["progressPercent"])
        if snap["status"] in ("COMPLETED", "FAILED"):
            break
        time.sleep(0.2)
    assert snap["status"] == "COMPLETED" and snap["progressPercent"] == 100
    assert seen == sorted(seen)
    res = c.get("/v1/jobs/job-api-0001/result", headers=H).json()
    assert len(res["events"]) == 4 and all(e["reviewStatus"] == "PENDING" for e in res["events"])
    # traversal attempt fails cleanly
    c.post("/v1/jobs", json={"jobId": "job-api-0002", "videoKey": "../sample.mp4"}, headers=H)
    time.sleep(1.5)
    bad = c.get("/v1/jobs/job-api-0002", headers=H).json()
    assert bad["status"] == "FAILED" and bad["errorCode"] == "VALIDATION_ERROR"
    assert c.get("/v1/jobs/unknown", headers=H).status_code == 404
