import json
import cv2
import numpy as np
from training.eval_events import evaluate
from training.prepare_dataset import prepare


def test_event_metrics():
    gt = [{"video": "a", "type": "SUDDEN_RUNNING", "start": 3, "end": 5}, {"video": "a", "type": "PERSON_LOITERING", "start": 10, "end": 20}]
    pred = {"a": [{"eventType": "SUDDEN_RUNNING", "startTimeSeconds": 3.2, "endTimeSeconds": 5.0},
                  {"eventType": "SUDDEN_RUNNING", "startTimeSeconds": 30, "endTimeSeconds": 31}]}
    m = evaluate(gt, pred)
    assert m["SUDDEN_RUNNING"]["tp"] == 1 and m["SUDDEN_RUNNING"]["fp"] == 1 and m["SUDDEN_RUNNING"]["precision"] == 0.5
    assert m["PERSON_LOITERING"]["fn"] == 1 and m["PERSON_LOITERING"]["recall"] == 0.0


def _voc(path, w, h, boxes, name="x"):
    objs = "".join(f"<object><name>{n}</name><bndbox><xmin>{a}</xmin><ymin>{b}</ymin><xmax>{c}</xmax><ymax>{d}</ymax></bndbox></object>" for n, a, b, c, d in boxes)
    path.write_text(f"<annotation><filename>{name}</filename><path>C:\\\\Users\\\\x\\\\{name}.jpg</path><size><width>{w}</width><height>{h}</height></size>{objs}</annotation>")


def test_separate_folders_case_insensitive_stems_and_stale_xml_size(tmp_path):
    # mirrors the REAL OD-WeaponDetection layout: Images/ + annotations/ siblings, .JPG vs .xml, <filename> without extension
    imgs, anns = tmp_path / "Images", tmp_path / "annotations"; imgs.mkdir(); anns.mkdir()
    for i in range(20):
        cv2.imwrite(str(imgs / f"DSC_{i:04d}.JPG"), np.zeros((100, 200, 3), np.uint8))          # real size 200x100
        _voc(anns / f"DSC_{i:04d}.xml", 400, 200, [("Knife", 40, 20, 240, 120), ("knife", 0, 0, 1, 1)], name=f"DSC_{i:04d}")  # stale XML size 400x200
    _voc(anns / "orphan.xml", 100, 100, [("knife", 1, 1, 50, 50)])                                 # annotation without an image
    neg = tmp_path / "neg"; neg.mkdir()
    for i in range(10):
        cv2.imwrite(str(neg / f"n{i}.jpg"), np.zeros((50, 50, 3), np.uint8))
    rep = prepare([(imgs, anns)], tmp_path / "out", "voc", None, seed=1, negatives=neg)
    assert rep["annotations"] == 21 and rep["no_image"] == 1 and rep["labeled_images_used"] == 20 and rep["dropped_boxes"] == 20
    assert rep["names"] == ["knife"] and rep["boxes_per_class"]["knife"] == 20 and rep["negative_images"] == 10
    lab = next((tmp_path / "out" / "labels" / "train").glob("*.txt"))
    rows = [r for r in lab.read_text().splitlines() if r]
    if rows:                                    # box was rescaled by the real/XML size ratio: (40..240)/400 -> centre 0.35, width 0.5
        c, x, y, w, h = rows[0].split(); assert abs(float(x) - 0.35) < 1e-3 and abs(float(w) - 0.5) < 1e-3
    empty = [p for p in (tmp_path / "out" / "labels" / "train").glob("*.txt") if not p.read_text().strip()]
    assert empty or rep["split"]["train"] > 0   # negatives become empty label files
