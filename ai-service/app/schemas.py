from dataclasses import dataclass, field


@dataclass(frozen=True)
class Observation:
    """One tracked detection. bbox is normalized (x1,y1,x2,y2)."""
    t: float
    bbox: tuple[float, float, float, float]
    conf: float
    torso_angle: float | None = None  # degrees from vertical (pose model); None when no pose was matched

    @property
    def center(self) -> tuple[float, float]:
        return ((self.bbox[0] + self.bbox[2]) / 2, (self.bbox[1] + self.bbox[3]) / 2)

    @property
    def foot(self) -> tuple[float, float]:
        """Bottom-center: representative ground point for zone checks."""
        return ((self.bbox[0] + self.bbox[2]) / 2, self.bbox[3])


@dataclass
class Track:
    """Analysis-scoped track. track_id is NOT a real-world identity."""
    track_id: int
    class_name: str
    observations: list[Observation] = field(default_factory=list)


@dataclass
class CandidateEvent:
    event_type: str
    track_id: int
    start_time: float
    end_time: float
    confidence: float
    measurements: dict
    description: str
    zone_id: str | None = None
    review_status: str = "PENDING"  # AI output must never be anything else
