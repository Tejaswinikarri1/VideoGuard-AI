import threading
from collections import deque
from datetime import datetime, timezone


class Cancelled(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class JobState:
    """Thread-safe, real pipeline state. Progress is monotonic within a job."""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.lock = threading.Lock()
        self.status = "QUEUED"
        self.stage = "JOB_ACCEPTED"
        self.progress = 0
        self.stage_progress = 0
        self.stages: list[dict] = []
        self.logs: deque[str] = deque(maxlen=500)
        self.error_code: str | None = None
        self.error_message: str | None = None
        self.result: dict | None = None
        self.cancel = threading.Event()

    def log(self, level: str, msg: str) -> None:
        with self.lock:
            self.logs.append(f"{_now()} {level} {msg}")

    def begin(self, stage: str, base: int) -> None:
        with self.lock:
            if self.stages and "completedAt" not in self.stages[-1]:
                self.stages[-1]["completedAt"] = _now()
            self.stages.append({"stage": stage, "startedAt": _now()})
            self.stage, self.stage_progress = stage, 0
            self.progress = max(self.progress, base)
        if self.cancel.is_set():
            raise Cancelled()

    def advance(self, fraction: float, base: int, span: int) -> None:
        f = max(0.0, min(1.0, fraction))
        with self.lock:
            self.stage_progress = int(f * 100)
            self.progress = max(self.progress, base + int(f * span))
        if self.cancel.is_set():
            raise Cancelled()

    def snapshot(self) -> dict:
        with self.lock:
            return {"jobId": self.job_id, "status": self.status, "stage": self.stage, "progressPercent": self.progress,
                    "stageProgressPercent": self.stage_progress, "stages": [dict(s) for s in self.stages], "logs": list(self.logs),
                    "errorCode": self.error_code, "errorMessage": self.error_message}
