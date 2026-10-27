"""YOLOv8n-pose adapter (17 COCO keypoints). Used ONLY for posture-based rules such as fall detection."""
import math
from dataclasses import dataclass
from pathlib import Path

from app.detection.yolo_detector import ModelUnavailable

# COCO keypoint indices
NOSE, L_SHO, R_SHO, L_HIP, R_HIP, L_ANK, R_ANK = 0, 5, 6, 11, 12, 15, 16


@dataclass(frozen=True)
class PoseDet:
    t: float
    bbox: tuple[float, float, float, float]   # normalized x1,y1,x2,y2
    conf: float
    keypoints: tuple[tuple[float, float, float], ...]  # 17 x (x_norm, y_norm, visibility)

    @property
    def torso_angle(self) -> float | None:
        return torso_angle_deg(self.keypoints)


def torso_angle_deg(kp, min_vis: float = 0.3) -> float | None:
    """Angle (degrees) between the shoulder->hip line and the vertical image axis: ~0 standing/sitting upright, ~90 lying sideways.
    Needs both shoulders and both hips visible; returns None otherwise (never guesses). Note: image-plane angle, so a person seen
    from directly above or walking toward the camera can look 'short' without being lying; the rule layer guards against this."""
    pts = [kp[i] for i in (L_SHO, R_SHO, L_HIP, R_HIP)]
    if any(p[2] < min_vis for p in pts):
        return None
    sx, sy = (kp[L_SHO][0] + kp[R_SHO][0]) / 2, (kp[L_SHO][1] + kp[R_SHO][1]) / 2
    hx, hy = (kp[L_HIP][0] + kp[R_HIP][0]) / 2, (kp[L_HIP][1] + kp[R_HIP][1]) / 2
    return math.degrees(math.atan2(abs(hx - sx), abs(hy - sy)))  # 0 = vertical, 90 = horizontal


class YoloPoseDetector:
    def __init__(self, model_path: str, device: str, imgsz: int, conf: float):
        self.model_path, self.device, self.imgsz, self.conf = model_path, device, imgsz, conf
        self._m = None

    def load(self) -> None:
        if not Path(self.model_path).is_file():
            raise ModelUnavailable(f"Pose weights not found: {self.model_path}. Run scripts/download_weights.py --pose")
        try:
            from ultralytics import YOLO
        except Exception as e:
            raise ModelUnavailable(f"ML stack unavailable: {e}") from e
        self._m = YOLO(self.model_path)
        if getattr(self._m.model, "kpt_shape", None) != [17, 3]:
            raise ModelUnavailable("Checkpoint is not a 17-keypoint COCO pose model")

    def detect(self, frame_bgr, t: float) -> list[PoseDet]:
        if self._m is None:
            raise ModelUnavailable("Pose detector not loaded")
        r = self._m.predict(frame_bgr, imgsz=self.imgsz, conf=self.conf, device=self.device, verbose=False)[0]
        out: list[PoseDet] = []
        if r.keypoints is None or r.boxes is None:
            return out
        xy, cf, bx = r.keypoints.xyn.cpu().numpy(), r.keypoints.conf, r.boxes
        cfa = cf.cpu().numpy() if cf is not None else None
        for i in range(len(bx)):
            x1, y1, x2, y2 = bx.xyxyn[i].tolist()
            kps = tuple((float(xy[i][k][0]), float(xy[i][k][1]), float(cfa[i][k]) if cfa is not None else 1.0) for k in range(17))
            out.append(PoseDet(t, (x1, y1, x2, y2), float(bx.conf[i]), kps))
        return out
