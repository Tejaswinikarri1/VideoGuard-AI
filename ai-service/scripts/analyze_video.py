"""Analyze ANY local video with the real pipeline (no web app, database or backend needed).

  python scripts\\analyze_video.py C:\\videos\\lobby.mp4
  python scripts\\analyze_video.py lobby.mp4 --pose --zone "0.1,0.4;0.6,0.4;0.6,0.95;0.1,0.95" --out results

Runs: frame sampling -> YOLOv8n detection (+ optional pose, weapon checkpoint) -> ByteTrack -> loitering / running / intrusion / fall /
weapon rules -> severity -> annotated evidence images. Prints stage timings, tracks and events; writes result.json and evidence/*.jpg to --out.
Thresholds are the .env defaults (uncalibrated): treat the output as candidate events for human review, not as ground truth."""
import argparse
import dataclasses
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import Settings  # noqa: E402
from app.detection.pose_detector import YoloPoseDetector  # noqa: E402
from app.detection.yolo_detector import ModelUnavailable, YoloDetector  # noqa: E402
from app.geometry import validate_polygon  # noqa: E402
from app.pipeline.runner import AnalysisError, run_pipeline  # noqa: E402
from app.pipeline.state import JobState  # noqa: E402
from app.pipeline.tracker import ByteTrackAdapter  # noqa: E402


def parse_zone(txt: str, i: int) -> dict:
    pts = [[float(v) for v in p.split(",")] for p in txt.split(";")]
    errs = validate_polygon([tuple(p) for p in pts])
    if errs:
        sys.exit(f"Invalid --zone: {'; '.join(errs)}")
    return {"id": f"zone{i}", "name": f"Zone {i}", "polygon": pts, "enabled": True}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--out", default="analysis_out"); ap.add_argument("--fps", type=float, default=None, help="sampled frames per second (default AI_SAMPLING_FPS=5)")
    ap.add_argument("--zone", action="append", default=[], help='normalized polygon "x,y;x,y;..." (repeatable)')
    ap.add_argument("--pose", action="store_true", help="enable posture model (fall detection)")
    ap.add_argument("--weapon-model", default=None, help="path to a fine-tuned weapon checkpoint (best.pt)")
    ap.add_argument("--weapon-labels", default=None, help="comma list of that checkpoint's weapon class names")
    a = ap.parse_args()
    video = Path(a.video).resolve()
    if not video.is_file():
        sys.exit(f"Video not found: {video}")
    s = Settings()
    if a.fps:
        s = dataclasses.replace(s, sampling_fps=a.fps)
    det = YoloDetector(s.yolov8_model_path, s.device, s.imgsz, s.detection_confidence)
    pose = weapon = None
    try:
        det.load()
        if a.pose:
            pose = YoloPoseDetector(s.pose_model_path, s.device, s.imgsz, 0.35); pose.load()
        if a.weapon_model:
            labels = {x.strip().lower() for x in (a.weapon_labels or s.weapon_labels).split(",") if x.strip()}
            weapon = YoloDetector(a.weapon_model, s.device, s.imgsz, s.weapon_confidence, "weapon", labels); weapon.load()
    except ModelUnavailable as e:
        sys.exit(f"Model problem: {e}")
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    zones = [parse_zone(z, i + 1) for i, z in enumerate(a.zone)]
    st = JobState("cli-analysis")
    t0 = time.time()
    try:
        res = run_pipeline("cli-analysis", str(video), zones, s, det, weapon, lambda fps: ByteTrackAdapter(fps), st, out / "evidence", "cli", pose)
    except AnalysisError as e:
        sys.exit(f"Analysis failed [{e.code}]: {e.message}")
    print(f"\nFinished in {time.time() - t0:.1f}s")
    for l in st.snapshot()["logs"]:
        print("  ", l[27:])
    print(f"\nTracks ({len(res['tracksSummary'])}):")
    for t in sorted(res["tracksSummary"], key=lambda t: -t["observationCount"])[:12]:
        print(f"   track {t['trackId']:>3} {t['className']:8s} {t['observationCount']:4d} obs  {t['firstSeenSeconds']:.1f}s - {t['lastSeenSeconds']:.1f}s")
    print(f"\nEvents ({len(res['events'])}), all PENDING human review:")
    for e in res["events"]:
        print(f"   [{e['severity']:6s}] {e['eventType']:26s} {e['startTimeSeconds']:7.1f}s - {e['endTimeSeconds']:7.1f}s  conf={e['confidence']:.2f}  {e['description']}")
    (out / "result.json").write_text(json.dumps(res, indent=2))
    print(f"\nSaved {out / 'result.json'} and evidence images under {out / 'evidence'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
