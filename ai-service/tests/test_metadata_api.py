import shutil
import subprocess

import pytest
from fastapi.testclient import TestClient

from app.metadata import MetadataError, probe_video

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")


@pytest.fixture(scope="module")
def sample(tmp_path_factory):
    p = tmp_path_factory.mktemp("v") / "s.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=3",
                    "-pix_fmt", "yuv420p", str(p)], check=True)
    return p


def test_probe_reads_actual_values(sample):
    m = probe_video(str(sample))
    assert (m["width"], m["height"]) == (320, 240) and m["frameRate"] == 25.0
    assert 2.9 <= m["durationSeconds"] <= 3.1


def test_renamed_non_video_rejected(tmp_path):
    f = tmp_path / "fake.mp4"
    f.write_text("this is not a video")
    with pytest.raises(MetadataError):
        probe_video(str(f))


def test_health_reports_degraded_without_weights(monkeypatch):
    monkeypatch.setenv("YOLOV8_MODEL_PATH", "models/does-not-exist.pt")
    monkeypatch.setenv("AI_SERVICE_TOKEN", "t" * 32)
    import importlib, app.main as m
    importlib.reload(m)
    with TestClient(m.app) as c:
        assert c.get("/health").json()["status"] == "degraded"
        assert c.get("/v1/models").status_code == 401
        body = c.get("/v1/models", headers={"X-Service-Token": "t" * 32}).json()
        assert body["loaded"] is False and "Weights not found" in body["error"]
