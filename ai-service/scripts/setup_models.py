"""Download the official pretrained YOLOv8n weights (Ultralytics assets, AGPL-3.0) and print their sha256."""
import hashlib, sys, urllib.request
from pathlib import Path

_name = "yolov8n-pose.pt" if "--pose" in sys.argv else "yolov8n.pt"
URL = f"https://github.com/ultralytics/assets/releases/download/v8.3.0/{_name}"
dest = Path("models") / _name
dest.parent.mkdir(exist_ok=True)
if not dest.exists():
    print("downloading", URL)
    urllib.request.urlretrieve(URL, dest)
print(dest, dest.stat().st_size, "bytes sha256", hashlib.sha256(dest.read_bytes()).hexdigest())
if dest.stat().st_size < 1_000_000:
    sys.exit("download looks truncated")
