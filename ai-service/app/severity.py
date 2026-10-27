"""Deterministic, documented severity rules (version SEVERITY_VERSION). Severity is a prioritisation aid, not a verdict.

LOITERING  : observed duration / loiteringThreshold   -> >= HIGH ratio: HIGH, >= MEDIUM ratio: MEDIUM, else LOW
RUNNING    : peak speed (body-heights/s) / runningThreshold -> >= HIGH ratio: HIGH, >= MEDIUM ratio: MEDIUM, else LOW
INTRUSION  : seconds spent inside the zone            -> >= HIGH s: HIGH, >= MEDIUM s: MEDIUM, else LOW
FALL       : seconds the person stays down -> >= HIGH s: HIGH, >= MEDIUM s: MEDIUM, else LOW (staying down is what raises concern)
WEAPON     : always >= MEDIUM; HIGH when seen in >= 5 sampled frames with max confidence >= 0.6
Detector confidence never decides severity on its own (it only participates in the weapon HIGH condition together with persistence).
"""
from app.config import Settings

SEVERITY_VERSION = "severity-1.0.0"


def classify(event_type: str, m: dict, s: Settings) -> str:
    if event_type == "PERSON_LOITERING":
        r = m.get("durationSeconds", 0) / max(s.loitering_threshold_seconds, 1e-6)
        return "HIGH" if r >= s.sev_loiter_high else "MEDIUM" if r >= s.sev_loiter_medium else "LOW"
    if event_type == "SUDDEN_RUNNING":
        r = m.get("peakSpeedBodyHeightsPerSec", 0) / max(s.running_speed_threshold, 1e-6)
        return "HIGH" if r >= s.sev_run_high else "MEDIUM" if r >= s.sev_run_medium else "LOW"
    if event_type == "RESTRICTED_AREA_INTRUSION":
        dwell = m.get("lastInsideTimestamp", 0) - m.get("entryTimestamp", 0)
        return "HIGH" if dwell >= s.sev_intrusion_high_s else "MEDIUM" if dwell >= s.sev_intrusion_medium_s else "LOW"
    if event_type == "FALL_DETECTED":
        d = m.get("lyingSeconds", 0)
        return "HIGH" if d >= s.sev_fall_high_s else "MEDIUM" if d >= s.sev_fall_medium_s else "LOW"
    if event_type == "WEAPON_DETECTION":
        return "HIGH" if m.get("hits", 0) >= 5 and m.get("maxConfidence", 0) >= 0.6 else "MEDIUM"
    return "LOW"
