"""Extract still frames from videos to use as NEGATIVE (weapon-free) training images or for labeling.
  python -m training.extract_frames --videos C:\\videos --out datasets\\negatives --every 3
Only use footage you have the right to use, and check by eye that it really contains no weapons."""
import argparse
from pathlib import Path

import cv2

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--videos", required=True, type=Path); ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--every", type=float, default=3.0, help="seconds between frames"); ap.add_argument("--max-per-video", type=int, default=300)
    a = ap.parse_args(); a.out.mkdir(parents=True, exist_ok=True)
    vids = [a.videos] if a.videos.is_file() else sorted(p for p in a.videos.rglob("*") if p.suffix.lower() in {".mp4", ".mov", ".avi", ".mkv", ".webm"})
    total = 0
    for v in vids:
        cap = cv2.VideoCapture(str(v)); fps = cap.get(cv2.CAP_PROP_FPS) or 25; step = max(1, int(fps * a.every)); i = n = 0
        while n < a.max_per_video:
            ok = cap.grab()
            if not ok:
                break
            if i % step == 0:
                ok, fr = cap.retrieve()
                if ok:
                    cv2.imwrite(str(a.out / f"{v.stem}_{i:07d}.jpg"), fr, [cv2.IMWRITE_JPEG_QUALITY, 92]); n += 1
            i += 1
        cap.release(); total += n; print(f"{v.name}: {n} frames")
    print(f"total {total} frames -> {a.out}")
