"""Proves the AI stack really works on THIS machine. Run from the ai-service folder:  python scripts\\verify_model.py [image.jpg]

1. loads the configured YOLOv8n weights through the project's detector adapter and prints the checkpoint's real class names,
2. runs inference on a real photo (downloads Ultralytics' public bus.jpg unless you pass your own image) and prints the detections,
3. measures ms/frame,
4. feeds two frames to the ByteTrack adapter and prints the track IDs.
Exit code 0 only if every step succeeded."""
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import cv2  # noqa: E402

from app.config import Settings  # noqa: E402
from app.detection.yolo_detector import ModelUnavailable, YoloDetector  # noqa: E402
from app.pipeline.tracker import ByteTrackAdapter  # noqa: E402

s = Settings()
weights = Path(s.yolov8_model_path)
if not weights.is_file():
    sys.exit(f"FAIL: {weights} not found. Run: python scripts\\download_weights.py")

img_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("models/_verify_bus.jpg")
if not img_path.is_file():
    print("downloading sample image (Ultralytics bus.jpg)...")
    urllib.request.urlretrieve("https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg", img_path)
img = cv2.imread(str(img_path))
if img is None:
    sys.exit(f"FAIL: could not read image {img_path}")

det = YoloDetector(str(weights), s.device, s.imgsz, s.detection_confidence)
try:
    det.load()
except ModelUnavailable as e:
    sys.exit(f"FAIL: {e}")
names = det.names
print(f"[1] model loaded: {len(names)} classes; person={'person' in names.values()} knife={'knife' in names.values()} gun={'gun' in names.values()}")
print(f"    supported categories: {det.resolution.supported}; unsupported: {det.resolution.unsupported_categories}")

det.detect(img, 0.0)  # warm-up
t = time.time()
dets = det.detect(img, 0.0)
ms = (time.time() - t) * 1000
print(f"[2] {len(dets)} detections on {img_path.name} {img.shape[1]}x{img.shape[0]}:")
for d in dets:
    print(f"      {d.category:8s} {d.label:10s} conf={d.conf:.2f} bbox={tuple(round(v, 3) for v in d.bbox)}")
print(f"[3] inference time: {ms:.0f} ms/frame (device={s.device})")
if not any(d.category == "person" for d in dets) and "bus" in img_path.name:
    sys.exit("FAIL: expected people in the sample photo")

tr = ByteTrackAdapter(5)
h, w = img.shape[:2]
ids1 = [t.track_id for t in tr.update(dets, w, h)]
ids2 = [t.track_id for t in tr.update(det.detect(img, 0.2), w, h)]
print(f"[4] ByteTrack ids frame1={ids1} frame2={ids2}  (same objects should keep the same ids)")
if ids1 and sorted(ids1) != sorted(i for i in ids2 if i in ids1):
    sys.exit("FAIL: track ids were not stable between identical frames")
print("OK: detector + tracker work on this machine.")
