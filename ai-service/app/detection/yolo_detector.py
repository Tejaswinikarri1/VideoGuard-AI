"""Ultralytics YOLO adapter. UNVERIFIED in the authoring sandbox (torch could not be imported there).
Imports are lazy so the rest of the service runs without the ML stack."""
from dataclasses import dataclass
from pathlib import Path

from app.detection.registry import ClassResolution, resolve_classes


class ModelUnavailable(RuntimeError):
    pass


@dataclass(frozen=True)
class Detection:
    t: float
    category: str
    label: str
    conf: float
    bbox: tuple[float, float, float, float]  # normalized x1,y1,x2,y2


class YoloDetector:
    def __init__(self, model_path: str, device: str, imgsz: int, conf: float, source: str = "primary", weapon_labels: set[str] | None = None):
        self.model_path, self.device, self.imgsz, self.conf, self.source = model_path, device, imgsz, conf, source
        self.weapon_labels = weapon_labels  # when set, only these checkpoint labels are exposed, all as category "weapon"
        self._model = None
        self.resolution: ClassResolution | None = None

    def load(self) -> None:
        if not Path(self.model_path).is_file():
            raise ModelUnavailable(f"Weights not found: {self.model_path}. Run scripts/setup_models.py.")
        try:
            from ultralytics import YOLO
        except Exception as e:  # ImportError or torch load failure
            raise ModelUnavailable(f"ML stack unavailable: {e}") from e
        self._model = YOLO(self.model_path)
        if self.weapon_labels is not None:
            present = [n for n in self._model.names.values() if n.lower() in self.weapon_labels]
            if not present:
                raise ModelUnavailable("Weapon checkpoint exposes none of the configured weapon labels: " + ", ".join(sorted(self.weapon_labels)))
            self.resolution = resolve_classes(self._model.names, {"weapon": present})
        else:
            self.resolution = resolve_classes(self._model.names)

    @property
    def names(self) -> dict[int, str]:
        return dict(self._model.names) if self._model else {}

    def detect(self, frame_bgr, t: float) -> list[Detection]:
        if self._model is None:
            raise ModelUnavailable("Detector not loaded")
        h, w = frame_bgr.shape[:2]
        out: list[Detection] = []
        r = self._model.predict(frame_bgr, imgsz=self.imgsz, conf=self.conf, device=self.device, verbose=False)[0]
        for b in r.boxes:
            label = self._model.names[int(b.cls)].lower()
            cat = self.resolution.label_to_category.get(label)
            if cat is None:
                continue  # unmapped classes are dropped, never relabeled
            x1, y1, x2, y2 = b.xyxy[0].tolist()
            out.append(Detection(t, cat, label, float(b.conf), (x1 / w, y1 / h, x2 / w, y2 / h)))
        return out

    def close(self) -> None:
        self._model = None
