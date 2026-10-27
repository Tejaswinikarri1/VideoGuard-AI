from app.activity.intrusion import detect_intrusion
from app.activity.loitering import detect_loitering
from app.activity.running import detect_running
from app.config import Settings
from tests.helpers import make_track

S = Settings()
ZONE = {"id": "z1", "name": "Server room", "polygon": [[0.5, 0.5], [0.9, 0.5], [0.9, 0.95], [0.5, 0.95]], "enabled": True}


def test_loitering_detected_with_measurements():
    # 12 s, 5 fps, tiny jitter
    pts = [(i * 0.2, 0.3 + 0.002 * (i % 3), 0.4) for i in range(61)]
    ev = detect_loitering(make_track(pts), S)
    assert len(ev) == 1
    e = ev[0]
    assert e.event_type == "PERSON_LOITERING" and e.review_status == "PENDING"
    assert e.measurements["durationSeconds"] >= S.loitering_threshold_seconds and e.measurements["spreadBodyHeights"] <= S.loitering_max_movement
    assert "approximately" in e.description and "suspicious" not in e.description.lower()


def test_loitering_not_for_moving_or_short_or_nonperson():
    walking = [(i * 0.2, 0.1 + i * 0.01, 0.4) for i in range(61)]
    assert detect_loitering(make_track(walking), S) == []
    short = [(i * 0.2, 0.3, 0.4) for i in range(20)]  # 3.8 s
    assert detect_loitering(make_track(short), S) == []
    still = [(i * 0.2, 0.3, 0.4) for i in range(61)]
    assert detect_loitering(make_track(still, class_name="car"), S) == []


def test_low_confidence_observations_ignored():
    pts = [(i * 0.2, 0.3, 0.4) for i in range(61)]
    assert detect_loitering(make_track(pts, conf=0.1), S) == []


def test_running_sustained_vs_single_jump():
    run = [(i * 0.2, 0.05 + i * 0.1, 0.5) for i in range(15)]  # 0.5 units/s for 2.8 s
    ev = detect_running(make_track(run), S)
    assert len(ev) == 1 and ev[0].event_type == "SUDDEN_RUNNING"
    assert ev[0].measurements["peakSpeedBodyHeightsPerSec"] >= S.running_speed_threshold
    jump = [(i * 0.2, 0.2 if i < 8 else 0.8, 0.5) for i in range(16)]  # one noisy leap
    assert detect_running(make_track(jump), S) == []
    walk = [(i * 0.2, 0.05 + i * 0.02, 0.5) for i in range(30)]  # 0.1 units/s
    assert detect_running(make_track(walk), S) == []


def test_running_respects_timestamps_not_frame_count():
    slow_sampling = [(i * 1.0, 0.05 + i * 0.1, 0.5) for i in range(10)]  # 0.1 units/s
    assert detect_running(make_track(slow_sampling), S) == []


def test_intrusion_uses_foot_point_and_zone_id():
    # foot (bottom-centre) = cy + 0.02; walk into zone around t=1.0
    pts = [(i * 0.2, 0.2 + i * 0.06, 0.8) for i in range(12)]
    ev = detect_intrusion(make_track(pts), [ZONE], S)
    assert len(ev) == 1 and ev[0].zone_id == "z1" and ev[0].measurements["zoneId"] == "z1"
    assert ev[0].measurements["entryTimestamp"] == ev[0].start_time


def test_intrusion_boundary_flicker_filtered_and_invalid_zones_skipped():
    flicker = [(0.0, 0.2, 0.8), (0.2, 0.6, 0.8), (0.4, 0.2, 0.8), (0.6, 0.6, 0.8), (0.8, 0.2, 0.8)]
    assert detect_intrusion(make_track(flicker), [ZONE], S) == []
    inside = [(i * 0.2, 0.7, 0.8) for i in range(10)]
    bad = {**ZONE, "polygon": [[0.5, 0.5], [0.9, 0.5]]}
    assert detect_intrusion(make_track(inside), [bad], S) == []
    assert detect_intrusion(make_track(inside), [{**ZONE, "enabled": False}], S) == []
    assert detect_intrusion(make_track(inside), [], S) == []
