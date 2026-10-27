"""The real analysis pipeline. Every stage does actual work on the video; nothing is simulated.

sample -> detect (primary [+ weapon]) -> track (ByteTrack) -> rules -> correlate -> severity -> evidence -> result
"""
import dataclasses
import shutil
import time
from pathlib import Path
from typing import Callable

import cv2

from app.activity.falls import detect_falls
from app.activity.intrusion import detect_intrusion
from app.activity.loitering import detect_loitering
from app.activity.running import detect_running
from app.activity.weapons import detect_weapons
from app.config import Settings
from app.evidence import make_evidence
from app.metadata import MetadataError, probe_video
from app.pipeline.state import Cancelled, JobState
from app.pipeline.tracker import TrackedDetection
from app.schemas import CandidateEvent, Observation, Track
from app.severity import SEVERITY_VERSION, classify

PIPELINE_VERSION = "1.0.0"
# (stage, base percent, span)
R = {"PREPARING_VIDEO": (1, 4), "FRAME_SAMPLING": (5, 10), "OBJECT_DETECTION": (15, 45), "OBJECT_TRACKING": (60, 10),
     "ACTIVITY_ANALYSIS": (70, 10), "EVENT_CORRELATION": (80, 4), "EVIDENCE_GENERATION": (84, 11), "PERSISTING_RESULTS": (95, 4)}


class AnalysisError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


def correlate(events: list[CandidateEvent], gap: float = 1.0) -> list[CandidateEvent]:
    """Merge repeated candidates of the same type/track/zone that overlap or touch; never merge across tracks."""
    out: list[CandidateEvent] = []
    for e in sorted(events, key=lambda e: (e.event_type, e.track_id, e.zone_id or "", e.start_time)):
        p = out[-1] if out else None
        if p and (p.event_type, p.track_id, p.zone_id) == (e.event_type, e.track_id, e.zone_id) and e.start_time - p.end_time <= gap:
            p.end_time = max(p.end_time, e.end_time)
            p.confidence = max(p.confidence, e.confidence)
            continue
        out.append(e)
    return sorted(out, key=lambda e: e.start_time)


def _trajectory(obs: list[Observation], start: float, end: float, limit: int = 60) -> list[list[float]]:
    pts = [o for o in obs if start - 1e-6 <= o.t <= end + 1e-6]
    step = max(1, len(pts) // limit + (1 if len(pts) % limit else 0))
    return [[round(o.t, 3), *[round(v, 4) for v in o.bbox]] for o in pts[::step]]


def _iou(a, b) -> float:
    ix, iy = max(0.0, min(a[2], b[2]) - max(a[0], b[0])), max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    i = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
    return i / u if u > 0 else 0.0


def _match_pose(o: Observation, poses: list) -> float | None:
    best = max(((_iou(o.bbox, p.bbox), p) for p in poses), key=lambda x: x[0], default=(0.0, None))
    return best[1].torso_angle if best[1] is not None and best[0] >= 0.4 else None


def _nearest(obs: list[Observation], t: float) -> Observation | None:
    return min(obs, key=lambda o: abs(o.t - t)) if obs else None


def run_pipeline(job_id: str, video_path: str, zones: list[dict], s: Settings, detector, weapon_detector,
                 make_tracker: Callable[[float], object], state: JobState, evidence_root: Path, model_version: str, pose_detector=None) -> dict:
    tmp = evidence_root / "_tmp" / job_id
    try:
        # 1 ─ prepare
        state.begin("PREPARING_VIDEO", R["PREPARING_VIDEO"][0])
        try:
            meta = probe_video(video_path)
        except MetadataError as e:
            raise AnalysisError("VIDEO_METADATA_FAILED", str(e)) from e
        fps = meta["frameRate"] or 25.0
        duration = meta["durationSeconds"] or 0.0
        state.log("INFO", f"Video metadata extracted: {meta['width']}x{meta['height']}, {fps:g} FPS, {duration:.1f}s")

        # 2 ─ sample frames (real decode; downscaled JPEGs in a temp dir)
        state.begin("FRAME_SAMPLING", R["FRAME_SAMPLING"][0])
        tmp.mkdir(parents=True, exist_ok=True)
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise AnalysisError("ANALYSIS_WORKER_FAILED", "The video could not be opened for decoding.")
        step_t = 1.0 / s.sampling_fps
        total_frames = max(1, int(duration * fps))
        samples: list[tuple[float, Path]] = []
        next_t, idx = 0.0, 0
        state.log("INFO", f"Starting frame sampling ({s.sampling_fps:g} FPS)")
        while True:
            if not cap.grab():
                break
            t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0 if cap.get(cv2.CAP_PROP_POS_MSEC) > 0 else idx / fps
            if t + 1e-6 >= next_t:
                ok, frame = cap.retrieve()
                if ok:
                    h, w = frame.shape[:2]
                    if w > s.max_frame_width:
                        frame = cv2.resize(frame, (s.max_frame_width, int(h * s.max_frame_width / w)), interpolation=cv2.INTER_AREA)
                    p = tmp / f"{len(samples):06d}.jpg"
                    cv2.imwrite(str(p), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
                    samples.append((t, p))
                next_t += step_t
            idx += 1
            if idx % 25 == 0:
                state.advance(idx / total_frames, *R["FRAME_SAMPLING"])
        cap.release()
        if not samples:
            raise AnalysisError("ANALYSIS_WORKER_FAILED", "No frames could be decoded from the video.")
        state.advance(1.0, *R["FRAME_SAMPLING"])
        state.log("INFO", f"Frame sampling completed: {len(samples)} frames extracted")

        # 3 ─ detection
        state.begin("OBJECT_DETECTION", R["OBJECT_DETECTION"][0])
        state.log("INFO", f"Running object detection ({model_version})")
        per_frame: list[tuple[float, list, int, int]] = []
        poses: list[list] = []
        t0 = time.time()
        for i, (t, p) in enumerate(samples):
            frame = cv2.imread(str(p))
            fh, fw = frame.shape[:2]
            dets = list(detector.detect(frame, t))
            if weapon_detector is not None:
                dets += list(weapon_detector.detect(frame, t))
            per_frame.append((t, dets, fw, fh))
            poses.append(list(pose_detector.detect(frame, t)) if pose_detector is not None else [])
            if i % 5 == 0 or i == len(samples) - 1:
                state.advance((i + 1) / len(samples), *R["OBJECT_DETECTION"])
        state.log("INFO", f"Processed {len(samples)} frames in {time.time() - t0:.1f}s")

        # 4 ─ tracking (fresh tracker per analysis)
        state.begin("OBJECT_TRACKING", R["OBJECT_TRACKING"][0])
        tracker = make_tracker(s.sampling_fps)
        tracks: dict[int, Track] = {}
        for i, (t, dets, fw, fh) in enumerate(per_frame):
            for td in tracker.update(dets, fw, fh):  # type: TrackedDetection
                tr = tracks.setdefault(td.track_id, Track(td.track_id, td.category))
                tr.observations.append(Observation(t, td.bbox, td.conf))
            if i % 10 == 0:
                state.advance((i + 1) / len(per_frame), *R["OBJECT_TRACKING"])
        if pose_detector is not None:  # attach the matched posture (torso angle) to each tracked observation
            by_t = {round(t, 4): ps for (t, _, _, _), ps in zip(per_frame, poses)}
            for tr in tracks.values():
                tr.observations = [dataclasses.replace(o, torso_angle=_match_pose(o, by_t.get(round(o.t, 4), []))) for o in tr.observations]
        state.log("INFO", f"Tracking produced {len(tracks)} tracks")

        # 5 ─ activity rules
        state.begin("ACTIVITY_ANALYSIS", R["ACTIVITY_ANALYSIS"][0])
        cands: list[CandidateEvent] = []
        for tr in tracks.values():
            cands += detect_loitering(tr, s) + detect_running(tr, s) + detect_intrusion(tr, zones, s)
            if pose_detector is not None:
                cands += detect_falls(tr, s)
        weapon_pairs = detect_weapons([(t, d) for t, d, _, _ in per_frame], s)
        state.advance(1.0, *R["ACTIVITY_ANALYSIS"])

        # 6 ─ correlation
        state.begin("EVENT_CORRELATION", R["EVENT_CORRELATION"][0])
        weapon_support = {id(e): g for e, g in weapon_pairs}
        events = correlate(cands) + [e for e, _ in weapon_pairs]
        events.sort(key=lambda e: e.start_time)
        state.log("INFO", f"{len(events)} events after correlation")

        # 7 ─ severity + evidence
        state.begin("EVIDENCE_GENERATION", R["EVIDENCE_GENERATION"][0])
        zone_by_id = {z["id"]: z for z in zones}
        out_events = []
        for i, e in enumerate(events):
            sev = classify(e.event_type, e.measurements, s)
            if id(e) in weapon_support:
                g = weapon_support[id(e)]
                best = max(g, key=lambda d: d.conf)
                bbox, label, ev_t = best.bbox, f"{best.label} {best.conf:.2f}", best.t
                traj = [[round(d.t, 3), *[round(v, 4) for v in d.bbox]] for d in g[:60]]
                track_id = None
            else:
                obs = tracks[e.track_id].observations
                mid = _nearest(obs, (e.start_time + e.end_time) / 2) if e.event_type == "PERSON_LOITERING" else _nearest(obs, e.start_time)
                bbox, ev_t = (mid.bbox if mid else None), (mid.t if mid else e.start_time)
                label = f"{tracks[e.track_id].class_name} track {e.track_id}"
                traj, track_id = _trajectory(obs, e.start_time, e.end_time), e.track_id
            poly = zone_by_id[e.zone_id]["polygon"] if e.zone_id in zone_by_id else None
            key = make_evidence(video_path, evidence_root, job_id, f"{e.event_type}|{track_id}|{e.start_time:.2f}|{e.zone_id}", ev_t, bbox, label, poly, s.max_frame_width)
            if key is None:
                state.log("WARNING", f"EVIDENCE_GENERATION_FAILED for {e.event_type} at {e.start_time:.1f}s")
            out_events.append({"eventType": e.event_type, "trackId": track_id, "startTimeSeconds": round(e.start_time, 3),
                               "endTimeSeconds": round(e.end_time, 3), "confidence": round(min(1.0, max(0.0, e.confidence)), 4), "severity": sev,
                               "description": e.description, "evidenceKey": key, "evidenceStatus": "AVAILABLE" if key else "FAILED",
                               "measurements": e.measurements, "zoneId": e.zone_id, "trajectory": traj, "reviewStatus": "PENDING"})
            state.advance((i + 1) / len(events), *R["EVIDENCE_GENERATION"])
        state.advance(1.0, *R["EVIDENCE_GENERATION"])

        # 8 ─ result assembly (the backend validates and persists)
        state.begin("PERSISTING_RESULTS", R["PERSISTING_RESULTS"][0])
        return {"modelVersion": model_version, "pipelineVersion": PIPELINE_VERSION, "ruleVersion": f"{s.rule_version}/{SEVERITY_VERSION}",
                "events": out_events,
                "tracksSummary": [{"trackId": t.track_id, "className": t.class_name, "observationCount": len(t.observations),
                                   "firstSeenSeconds": t.observations[0].t, "lastSeenSeconds": t.observations[-1].t} for t in tracks.values() if t.observations]}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
