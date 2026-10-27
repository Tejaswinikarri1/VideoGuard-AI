import hashlib
import hmac
import logging
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import Settings
from app.detection.yolo_detector import ModelUnavailable, YoloDetector
from app.detection.pose_detector import YoloPoseDetector
from app.jobs import JobManager

logging.basicConfig(level=logging.INFO, format='{"ts":"%(asctime)s","level":"%(levelname)s","msg":"%(message)s"}')
log = logging.getLogger("videoguard.ai")
app = FastAPI(title="VideoGuard AI service", version="1.0.0")
settings = Settings()
_detector: YoloDetector | None = None
_weapon: YoloDetector | None = None
_pose: YoloPoseDetector | None = None
_pose_error: str | None = None
_model_error: str | None = None
_weapon_error: str | None = None
_jobs: JobManager | None = None


def fingerprint(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:12]


def _default_tracker(fps: float):
    from app.pipeline.tracker import ByteTrackAdapter
    return ByteTrackAdapter(fps)


@app.on_event("startup")
def load_models() -> None:
    """Load only configured models. A missing/incompatible model is reported, never faked."""
    global _detector, _weapon, _pose, _pose_error, _model_error, _weapon_error, _jobs
    d = YoloDetector(settings.yolov8_model_path, settings.device, settings.imgsz, settings.detection_confidence)
    try:
        d.load()
        _detector = d
        log.info("detector loaded: %s classes=%d", settings.object_detector, len(d.names))
    except ModelUnavailable as e:
        _model_error = str(e)
        log.error("detector unavailable: %s", e)
    if settings.weapon_enabled:
        labels = {x.strip().lower() for x in settings.weapon_labels.split(",") if x.strip()}
        w = YoloDetector(settings.weapon_model_path, settings.device, settings.imgsz, settings.weapon_confidence, "weapon", labels)
        try:
            w.load()
            _weapon = w
        except ModelUnavailable as e:
            _weapon_error = str(e)
            log.error("weapon detector unavailable: %s", e)
    if settings.pose_enabled:
        pd = YoloPoseDetector(settings.pose_model_path, settings.device, settings.imgsz, 0.35)
        try:
            pd.load()
            _pose = pd
        except ModelUnavailable as e:
            _pose_error = str(e)
            log.error("pose detector unavailable: %s", e)
    if _detector:
        mv = f"{settings.object_detector}:{Path(settings.yolov8_model_path).name}@{fingerprint(settings.yolov8_model_path)}"
        if _weapon:
            mv += f"+weapon:{Path(settings.weapon_model_path).name}@{fingerprint(settings.weapon_model_path)}"
        if _pose:
            mv += f"+pose:{Path(settings.pose_model_path).name}@{fingerprint(settings.pose_model_path)}"
        _jobs = JobManager(settings, _detector, _weapon, _default_tracker, mv, _pose)


def require_token(x_service_token: str | None = Header(default=None)) -> None:
    if not settings.service_token:
        raise HTTPException(503, "AI_SERVICE_TOKEN is not configured")
    if not x_service_token or not hmac.compare_digest(x_service_token, settings.service_token):
        raise HTTPException(401, "invalid service token")


class Zone(BaseModel):
    id: str
    name: str = ""
    polygon: list[list[float]]
    enabled: bool = True


class JobRequest(BaseModel):
    jobId: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9-]+$")
    videoKey: str = Field(min_length=1, max_length=300)
    zones: list[Zone] = []


@app.get("/health")
def health():
    return {"status": "ok" if _detector else "degraded", "detectorLoaded": _detector is not None,
            "weaponDetectorLoaded": _weapon is not None}


@app.get("/v1/models", dependencies=[Depends(require_token)])
def models():
    if not _detector:
        return {"loaded": False, "error": _model_error}
    r = _detector.resolution
    return {"loaded": True, "detector": settings.object_detector, "weights": settings.yolov8_model_path,
            "classNames": _detector.names, "supportedCategories": r.supported, "unsupportedCategories": r.unsupported_categories,
            "pose": {"enabled": settings.pose_enabled, "loaded": _pose is not None, "error": _pose_error},
            "weapon": {"enabled": settings.weapon_enabled, "loaded": _weapon is not None, "error": _weapon_error,
                       "labels": sorted(_weapon.resolution.supported.get("weapon", [])) if _weapon else []}}


@app.post("/v1/jobs", status_code=202, dependencies=[Depends(require_token)])
def submit(req: JobRequest):
    if _jobs is None:
        raise HTTPException(503, f"AI_MODEL_UNAVAILABLE: {_model_error}")
    st = _jobs.submit(req.jobId, req.videoKey, [z.model_dump() for z in req.zones if z.enabled])
    return st.snapshot()


@app.get("/v1/jobs/{job_id}", dependencies=[Depends(require_token)])
def status(job_id: str):
    st = _jobs.get(job_id) if _jobs else None
    if not st:
        raise HTTPException(404, "unknown job")
    return st.snapshot()


@app.get("/v1/jobs/{job_id}/result", dependencies=[Depends(require_token)])
def result(job_id: str):
    st = _jobs.get(job_id) if _jobs else None
    if not st:
        raise HTTPException(404, "unknown job")
    if st.status != "COMPLETED" or st.result is None:
        raise HTTPException(409, "job is not completed")
    return st.result


@app.delete("/v1/jobs/{job_id}", dependencies=[Depends(require_token)])
def cancel(job_id: str):
    if not (_jobs and _jobs.cancel(job_id)):
        raise HTTPException(404, "unknown job")
    return {"cancelled": True}
