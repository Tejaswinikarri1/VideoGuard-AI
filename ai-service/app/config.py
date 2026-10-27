"""Environment-driven configuration. No secrets have defaults."""
import os
from dataclasses import dataclass, field


def _f(name: str, default: float) -> float:
    return float(os.getenv(name, default))


def _i(name: str, default: int) -> int:
    return int(os.getenv(name, default))


def _b(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in ("1", "true", "yes")


@dataclass(frozen=True)
class Settings:
    object_detector: str = field(default_factory=lambda: os.getenv("OBJECT_DETECTOR", "yolov8n"))
    yolov8_model_path: str = field(default_factory=lambda: os.getenv("YOLOV8_MODEL_PATH", "models/yolov8n.pt"))
    weapon_model_path: str = field(default_factory=lambda: os.getenv("WEAPON_MODEL_PATH", "models/weapon/best.pt"))
    weapon_enabled: bool = field(default_factory=lambda: _b("WEAPON_MODEL_ENABLED", False))
    device: str = field(default_factory=lambda: os.getenv("AI_DEVICE", "cpu"))
    imgsz: int = field(default_factory=lambda: _i("AI_IMAGE_SIZE", 640))
    detection_confidence: float = field(default_factory=lambda: _f("DETECTION_CONFIDENCE", 0.25))
    weapon_confidence: float = field(default_factory=lambda: _f("WEAPON_CONFIDENCE", 0.30))
    sampling_fps: float = field(default_factory=lambda: _f("AI_SAMPLING_FPS", 5))
    # Rule thresholds (normalized units; must be calibrated on labeled video)
    loitering_threshold_seconds: float = field(default_factory=lambda: _f("LOITERING_THRESHOLD_SECONDS", 8))
    loitering_max_movement: float = field(default_factory=lambda: _f("LOITERING_MAX_MOVEMENT", 0.75))   # in BODY HEIGHTS (distance-independent)
    min_track_observations: int = field(default_factory=lambda: _i("MIN_TRACK_OBSERVATIONS", 5))
    min_detection_confidence: float = field(default_factory=lambda: _f("MIN_RULE_CONFIDENCE", 0.3))
    running_speed_threshold: float = field(default_factory=lambda: _f("RUNNING_SPEED_THRESHOLD", 2.2))      # body heights per second (walking ~0.8, running ~3+)
    min_person_height: float = field(default_factory=lambda: _f("MIN_PERSON_HEIGHT", 0.05))             # ignore people shorter than this fraction of the frame (too far to measure)
    running_window_seconds: float = field(default_factory=lambda: _f("RUNNING_WINDOW_SECONDS", 1.0))
    motion_smoothing_window: int = field(default_factory=lambda: _i("MOTION_SMOOTHING_WINDOW", 3))
    intrusion_min_inside_observations: int = field(default_factory=lambda: _i("INTRUSION_MIN_INSIDE_OBS", 3))
    # Weapon rule
    weapon_labels: str = field(default_factory=lambda: os.getenv("WEAPON_LABELS", "knife,gun,pistol,handgun,rifle,grenade"))
    weapon_min_hits: int = field(default_factory=lambda: _i("WEAPON_MIN_HITS", 3))
    weapon_max_gap_seconds: float = field(default_factory=lambda: _f("WEAPON_MAX_GAP_SECONDS", 2.0))
    # Severity thresholds (documented in severity.py, version SEVERITY_VERSION)
    sev_loiter_medium: float = field(default_factory=lambda: _f("SEV_LOITER_MEDIUM_RATIO", 2.0))
    sev_loiter_high: float = field(default_factory=lambda: _f("SEV_LOITER_HIGH_RATIO", 4.0))
    sev_run_medium: float = field(default_factory=lambda: _f("SEV_RUN_MEDIUM_RATIO", 1.4))
    sev_run_high: float = field(default_factory=lambda: _f("SEV_RUN_HIGH_RATIO", 2.0))
    sev_intrusion_medium_s: float = field(default_factory=lambda: _f("SEV_INTRUSION_MEDIUM_SECONDS", 3.0))
    sev_intrusion_high_s: float = field(default_factory=lambda: _f("SEV_INTRUSION_HIGH_SECONDS", 10.0))
    # Fall rule (pose-based; see app/activity/falls.py)
    pose_enabled: bool = field(default_factory=lambda: _b("POSE_MODEL_ENABLED", False))
    pose_model_path: str = field(default_factory=lambda: os.getenv("POSE_MODEL_PATH", "models/yolov8n-pose.pt"))
    fall_upright_deg: float = field(default_factory=lambda: _f("FALL_UPRIGHT_DEG", 35))
    fall_lying_deg: float = field(default_factory=lambda: _f("FALL_LYING_DEG", 60))
    fall_transition_seconds: float = field(default_factory=lambda: _f("FALL_TRANSITION_SECONDS", 2.0))
    fall_lying_seconds: float = field(default_factory=lambda: _f("FALL_LYING_SECONDS", 2.5))
    sev_fall_medium_s: float = field(default_factory=lambda: _f("SEV_FALL_MEDIUM_SECONDS", 5.0))
    sev_fall_high_s: float = field(default_factory=lambda: _f("SEV_FALL_HIGH_SECONDS", 12.0))
    # Service
    service_token: str = field(default_factory=lambda: os.getenv("AI_SERVICE_TOKEN", ""))
    video_root: str = field(default_factory=lambda: os.getenv("VIDEO_STORAGE_ROOT", "../data/videos"))
    evidence_root: str = field(default_factory=lambda: os.getenv("EVIDENCE_STORAGE_ROOT", "../data/evidence"))
    max_frame_width: int = field(default_factory=lambda: _i("AI_MAX_FRAME_WIDTH", 960))
    max_concurrent_jobs: int = field(default_factory=lambda: _i("AI_MAX_CONCURRENT_JOBS", 1))
    rule_version: str = "1.0.0"
