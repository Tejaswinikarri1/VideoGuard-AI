import dataclasses
from app.activity.weapons import detect_weapons
from app.config import Settings
from app.detection.yolo_detector import Detection

S = dataclasses.replace(Settings(), weapon_min_hits=3, weapon_max_gap_seconds=2.0)


def det(t, x, label="knife", conf=0.7, cat="weapon"):
    return Detection(t, cat, label, conf, (x, 0.5, x + 0.05, 0.6))


def test_persistence_counts_distinct_frames_not_boxes():
    # 2 frames, but 6 non-overlapping boxes each: must NOT satisfy a 3-frame persistence rule
    frames = [(0.0, [det(0.0, 0.1 * i) for i in range(6)]), (0.2, [det(0.2, 0.1 * i) for i in range(6)])]
    assert detect_weapons(frames, S) == []
    frames.append((0.4, [det(0.4, 0.1)]))
    ev = detect_weapons(frames, S)
    assert len(ev) == 1 and ev[0][0].measurements["hits"] == 3 and "3 sampled frames" in ev[0][0].description


def test_two_models_seeing_the_same_object_count_once():
    both = [det(0.0, 0.3, cat="knife", conf=0.6), det(0.0, 0.3, cat="weapon", conf=0.9)]   # same label, same place
    frames = [(t, [Detection(t, d.category, d.label, d.conf, d.bbox) for d in both]) for t in (0.0, 0.2, 0.4)]
    ev = detect_weapons(frames, S)
    assert len(ev) == 1 and ev[0][0].measurements["maxConfidence"] == 0.9


def test_gap_splits_events_and_non_weapons_are_ignored():
    frames = [(t, [det(t, 0.3)]) for t in (0.0, 0.2, 0.4)] + [(t, [det(t, 0.3)]) for t in (6.0, 6.2, 6.4)]
    assert len(detect_weapons(frames, S)) == 2
    assert detect_weapons([(0.0, [Detection(0.0, "person", "person", 0.9, (0, 0, 1, 1))])] * 5, S) == []
