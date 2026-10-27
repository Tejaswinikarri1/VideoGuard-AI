"""Fine-tune YOLOv8n on a prepared weapon dataset, evaluate on the held-out TEST split, and export models/weapon/best.pt.

  python -m training.train_weapon --data datasets/weapons/data.yaml --epochs 50 --imgsz 640 --device cpu

Reports REAL metrics (precision, recall, mAP50, mAP50-95) measured on images the model never trained on, and writes them with the
dataset provenance to models/weapon/training_report.json. Nothing is claimed beyond those numbers."""
import argparse
import json
import shutil
import time
from pathlib import Path


def main(a: argparse.Namespace) -> dict:
    from ultralytics import YOLO
    data = Path(a.data)
    if not data.is_file():
        raise SystemExit(f"{data} not found. Run training.prepare_dataset first.")
    t0 = time.time()
    model = YOLO(a.base)
    model.train(data=str(data), epochs=a.epochs, imgsz=a.imgsz, batch=a.batch, device=a.device, project=a.project, name=a.name,
                exist_ok=True, plots=False, workers=a.workers, patience=a.patience, seed=0, verbose=False)
    best = Path(model.trainer.best)
    final = YOLO(str(best))
    m = final.val(data=str(data), split="test", imgsz=a.imgsz, device=a.device, plots=False, verbose=False)
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, out / "best.pt")
    report = {"base": a.base, "data": str(data), "epochs": a.epochs, "imgsz": a.imgsz, "train_seconds": round(time.time() - t0, 1),
              "classes": dict(final.names), "test_split_metrics": {"precision": float(m.box.mp), "recall": float(m.box.mr), "mAP50": float(m.box.map50), "mAP50_95": float(m.box.map)},
              "dataset_note": a.dataset_note, "weights": str(out / "best.pt")}
    (out / "training_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True); ap.add_argument("--base", default="models/yolov8n.pt")
    ap.add_argument("--epochs", type=int, default=50); ap.add_argument("--imgsz", type=int, default=640); ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--device", default="cpu"); ap.add_argument("--workers", type=int, default=2); ap.add_argument("--patience", type=int, default=15)
    ap.add_argument("--project", default="runs/weapon"); ap.add_argument("--name", default="train"); ap.add_argument("--out-dir", default="models/weapon")
    ap.add_argument("--dataset-note", default="Record the dataset name, URL, license and version here.")
    main(ap.parse_args())
