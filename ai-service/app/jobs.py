import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app.config import Settings
from app.pipeline.runner import AnalysisError, run_pipeline
from app.pipeline.state import Cancelled, JobState


def resolve_video(root: str, key: str) -> Path:
    base = Path(root).resolve()
    p = (base / key).resolve()
    if base not in p.parents:
        raise AnalysisError("VALIDATION_ERROR", "Invalid video key.")
    if not p.is_file():
        raise AnalysisError("RESOURCE_NOT_FOUND", "Video file not found.")
    return p


class JobManager:
    """In-memory job registry + worker pool. Submission is idempotent by jobId. State is lost on restart (the backend then
    marks the analysis failed or re-queues it)."""

    def __init__(self, settings: Settings, detector, weapon_detector, make_tracker, model_version: str, pose_detector=None):
        self.s, self.detector, self.weapon, self.make_tracker, self.model_version = settings, detector, weapon_detector, make_tracker, model_version
        self.pose = pose_detector
        self.jobs: dict[str, JobState] = {}
        self.lock = threading.Lock()
        self.pool = ThreadPoolExecutor(max_workers=max(1, settings.max_concurrent_jobs))

    def submit(self, job_id: str, video_key: str, zones: list[dict]) -> JobState:
        with self.lock:
            if job_id in self.jobs:
                return self.jobs[job_id]
            st = JobState(job_id)
            self.jobs[job_id] = st
        st.log("INFO", f"Analysis job {job_id} accepted")
        self.pool.submit(self._run, st, video_key, zones)
        return st

    def get(self, job_id: str) -> JobState | None:
        return self.jobs.get(job_id)

    def cancel(self, job_id: str) -> bool:
        st = self.jobs.get(job_id)
        if st:
            st.cancel.set()
        return st is not None

    def _run(self, st: JobState, video_key: str, zones: list[dict]) -> None:
        if st.cancel.is_set():
            st.status = "CANCELLED"
            return
        st.status = "RUNNING"
        try:
            path = resolve_video(self.s.video_root, video_key)
            res = run_pipeline(st.job_id, str(path), zones, self.s, self.detector, self.weapon, self.make_tracker, st,
                               Path(self.s.evidence_root), self.model_version, self.pose)
            with st.lock:
                st.result, st.status, st.stage, st.progress, st.stage_progress = res, "COMPLETED", "COMPLETED", 100, 100
                if st.stages and "completedAt" not in st.stages[-1]:
                    from app.pipeline.state import _now
                    st.stages[-1]["completedAt"] = _now()
            st.log("INFO", f"Analysis completed with {len(res['events'])} events")
        except Cancelled:
            st.status = "CANCELLED"
            st.log("INFO", "Analysis cancelled")
        except AnalysisError as e:
            st.status, st.error_code, st.error_message = "FAILED", e.code, e.message
            st.log("ERROR", e.message)
        except Exception as e:  # never leak internals to clients
            st.status, st.error_code, st.error_message = "FAILED", "ANALYSIS_WORKER_FAILED", "The analysis failed unexpectedly."
            st.log("ERROR", f"Unexpected failure: {type(e).__name__}")
