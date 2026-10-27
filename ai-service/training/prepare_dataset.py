"""Convert detection datasets (Pascal VOC XML or YOLO txt) into the Ultralytics layout + data.yaml.

Generic folder (images and labels side by side or anywhere under --src):
  python -m training.prepare_dataset --src C:/data/weapons --out datasets/weapons --format voc
Datasets whose images and annotations live in SEPARATE folders (e.g. OD-WeaponDetection):
  python -m training.prepare_dataset --pair "C:/od/Pistol detection/Weapons::C:/od/Pistol detection/xmls" \\
                                     --pair "C:/od/Knife_detection/Images::C:/od/Knife_detection/annotations" --out datasets/od_weapon --format voc
Hard negatives (images that contain NO weapon, e.g. frames of your own CCTV footage) are strongly recommended:
  --negatives C:/data/negative_frames

Matching is by FILE NAME STEM, case-insensitive (the <filename>/<path> tags inside VOC files are ignored: they are often wrong).
Boxes are rescaled if the XML's size differs from the real image size; degenerate / out-of-range boxes are dropped.
Split is by image (seeded). Near-duplicate frames of the same scene can leak between splits: if the source ships its own
train/val/test folders, prefer those. Writes <out>/prepare_report.json with counts per class and per split."""
import argparse
import json
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

IMG_EXT = {".jpg", ".jpeg", ".png", ".bmp"}


def _image_size(p: Path):
    import cv2
    im = cv2.imread(str(p))
    return (im.shape[1], im.shape[0]) if im is not None else None


def voc_to_yolo(xml_path: Path, names: list[str], real_size) -> tuple[list[str], int]:
    root = ET.parse(xml_path).getroot()
    xw, xh = float(root.findtext("size/width", "0") or 0), float(root.findtext("size/height", "0") or 0)
    w, h = real_size if real_size else (xw, xh)
    if w <= 0 or h <= 0:
        return [], len(root.findall("object"))
    sx, sy = (w / xw if xw > 0 else 1.0), (h / xh if xh > 0 else 1.0)   # rescale when the XML size is stale
    lines, dropped = [], 0
    for obj in root.findall("object"):
        name = (obj.findtext("name") or "").strip().lower()
        bb = obj.find("bndbox")
        try:
            x1, y1, x2, y2 = (float(bb.findtext(k)) for k in ("xmin", "ymin", "xmax", "ymax"))
        except (TypeError, ValueError, AttributeError):
            dropped += 1
            continue
        x1, x2, y1, y2 = max(0.0, x1 * sx), min(w, x2 * sx), max(0.0, y1 * sy), min(h, y2 * sy)
        if not name or x2 - x1 < 2 or y2 - y1 < 2:
            dropped += 1
            continue
        if name not in names:
            names.append(name)
        lines.append(f"{names.index(name)} {(x1 + x2) / 2 / w:.6f} {(y1 + y2) / 2 / h:.6f} {(x2 - x1) / w:.6f} {(y2 - y1) / h:.6f}")
    return lines, dropped


def clean_yolo(txt_path: Path, n_classes: int) -> tuple[list[str], int]:
    out, dropped = [], 0
    for ln in txt_path.read_text().splitlines():
        p = ln.split()
        try:
            c, x, y, w, h = int(p[0]), *(float(v) for v in p[1:5])
        except (ValueError, IndexError):
            dropped += 1
            continue
        if not (0 <= c < n_classes and 0 <= x <= 1 and 0 <= y <= 1 and 0 < w <= 1 and 0 < h <= 1):
            dropped += 1
            continue
        out.append(f"{c} {x:.6f} {y:.6f} {w:.6f} {h:.6f}")
    return out, dropped


def _index(folder: Path, exts: set[str]) -> dict[str, Path]:
    return {p.stem.lower(): p for p in sorted(folder.rglob("*")) if p.is_file() and p.suffix.lower() in exts}


def collect(pairs: list[tuple[Path, Path]], fmt: str, names: list[str]) -> tuple[list[tuple[Path, list[str]]], dict]:
    items, st = [], {"annotations": 0, "no_image": 0, "dropped_boxes": 0, "unusable": 0}
    for img_dir, ann_dir in pairs:
        imgs = _index(img_dir, IMG_EXT)
        for ann in sorted(p for p in ann_dir.rglob("*") if p.suffix.lower() == (".xml" if fmt == "voc" else ".txt")):
            if ann.name.lower() == "classes.txt":
                continue
            st["annotations"] += 1
            img = imgs.get(ann.stem.lower())
            if img is None:
                st["no_image"] += 1
                continue
            try:
                lines, dropped = voc_to_yolo(ann, names, _image_size(img)) if fmt == "voc" else clean_yolo(ann, len(names))
            except ET.ParseError:
                st["unusable"] += 1
                continue
            st["dropped_boxes"] += dropped
            if lines:
                items.append((img, lines))
            else:
                st["unusable"] += 1
    return items, st


def prepare(pairs, out: Path, fmt: str, names: list[str] | None = None, val: float = 0.15, test: float = 0.10, seed: int = 0,
            negatives: Path | None = None, max_negatives: int = 0) -> dict:
    names = [n.lower() for n in (names or [])]
    items, stats = collect(pairs, fmt, names)
    if not items:
        raise SystemExit(f"No usable labeled images. Stats: {stats}")
    rng = random.Random(seed)
    rng.shuffle(items)
    n_val, n_test = int(len(items) * val), int(len(items) * test)
    split = {"test": items[:n_test], "val": items[n_test:n_test + n_val], "train": items[n_test + n_val:]}
    neg_used = 0
    if negatives:
        negs = sorted(p for p in negatives.rglob("*") if p.suffix.lower() in IMG_EXT)
        rng.shuffle(negs)
        if max_negatives:
            negs = negs[:max_negatives]
        nv, nt = int(len(negs) * val), int(len(negs) * test)
        for part, sub in (("test", negs[:nt]), ("val", negs[nt:nt + nv]), ("train", negs[nt + nv:])):
            split[part] += [(p, []) for p in sub]
        neg_used = len(negs)
    for s, rows in split.items():
        (out / "images" / s).mkdir(parents=True, exist_ok=True)
        (out / "labels" / s).mkdir(parents=True, exist_ok=True)
        for i, (img, lines) in enumerate(rows):
            stem = f"{i:06d}_{''.join(c if c.isalnum() else '_' for c in img.stem)}"[:80]
            shutil.copy2(img, out / "images" / s / (stem + img.suffix.lower()))
            (out / "labels" / s / (stem + ".txt")).write_text("\n".join(lines) + ("\n" if lines else ""))
    counts: dict[str, int] = {}
    for rows in split.values():
        for _, lines in rows:
            for ln in lines:
                n = names[int(ln.split()[0])]
                counts[n] = counts.get(n, 0) + 1
    (out / "data.yaml").write_text(f"path: {out.resolve().as_posix()}\ntrain: images/train\nval: images/val\ntest: images/test\nnames:\n" + "".join(f"  {i}: {n}\n" for i, n in enumerate(names)))
    report = {"pairs": [[str(a), str(b)] for a, b in pairs], "format": fmt, **stats, "labeled_images_used": len(items), "negative_images": neg_used,
              "split": {k: len(v) for k, v in split.items()}, "boxes_per_class": counts, "names": names, "seed": seed}
    (out / "prepare_report.json").write_text(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", type=Path, help="folder with images+labels together (use --pair for separate folders)")
    ap.add_argument("--pair", action="append", default=[], help='"IMAGES_DIR::ANNOTATIONS_DIR" (repeatable)')
    ap.add_argument("--out", required=True, type=Path); ap.add_argument("--format", choices=["voc", "yolo"], required=True)
    ap.add_argument("--names", nargs="*", help="class names in index order (required for --format yolo)")
    ap.add_argument("--negatives", type=Path, help="folder of images with NO weapons (background frames)"); ap.add_argument("--max-negatives", type=int, default=0)
    ap.add_argument("--val", type=float, default=0.15); ap.add_argument("--test", type=float, default=0.10); ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    pairs = [(Path(p.split("::")[0]), Path(p.split("::")[1])) for p in a.pair] or ([(a.src, a.src)] if a.src else [])
    if not pairs:
        raise SystemExit("Give --src or at least one --pair")
    if a.format == "yolo" and not a.names:
        raise SystemExit("--names is required for --format yolo")
    print(json.dumps(prepare(pairs, a.out, a.format, a.names, a.val, a.test, a.seed, a.negatives, a.max_negatives), indent=2))
