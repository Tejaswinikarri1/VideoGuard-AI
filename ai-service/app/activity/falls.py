"""Fall rule (posture change), from a tracked person's torso angle (shoulder->hip line vs vertical, from YOLOv8n-pose).

A fall candidate = an UPRIGHT observation (angle <= fallUprightDeg) followed, within fallTransitionSeconds, by a LYING observation
(angle >= fallLyingDeg) AND the person then stays lying for >= fallLyingSeconds. Observations without a matched pose are ignored
(never guessed). Limits: the angle is measured in the image plane, so overhead cameras, heavy occlusion, crawling, exercising or
people who lie down on purpose can produce false positives, and falls toward/away from the camera can be missed. Calibrate on
labeled footage; every event still needs human review."""
from app.config import Settings
from app.schemas import CandidateEvent, Track


def detect_falls(track: Track, s: Settings) -> list[CandidateEvent]:
    if track.class_name != "person":
        return []
    obs = [o for o in sorted(track.observations, key=lambda o: o.t) if o.torso_angle is not None and o.conf >= s.min_detection_confidence]
    if len(obs) < max(3, s.min_track_observations // 2):
        return []
    events: list[CandidateEvent] = []
    i, n = 0, len(obs)
    while i < n:
        if obs[i].torso_angle > s.fall_upright_deg:
            i += 1
            continue
        up = obs[i]                                   # latest upright observation before a possible drop
        j = i + 1
        while j < n and obs[j].torso_angle <= s.fall_upright_deg:
            up = obs[j]; j += 1
        # first lying observation inside the transition window after `up`
        k = j
        while k < n and obs[k].t - up.t <= s.fall_transition_seconds and obs[k].torso_angle < s.fall_lying_deg:
            k += 1
        if k < n and obs[k].t - up.t <= s.fall_transition_seconds and obs[k].torso_angle >= s.fall_lying_deg:
            m = k
            while m + 1 < n and obs[m + 1].torso_angle >= s.fall_upright_deg + 10:   # stays down (hysteresis, not fully upright)
                m += 1
            lying = obs[m].t - obs[k].t
            if lying >= s.fall_lying_seconds:
                conf = sum(o.conf for o in obs[k:m + 1]) / (m - k + 1)
                events.append(CandidateEvent(
                    "FALL_DETECTED", track.track_id, up.t, obs[m].t, conf,
                    {"transitionSeconds": round(obs[k].t - up.t, 2), "lyingSeconds": round(lying, 2), "torsoAngleBefore": round(up.torso_angle, 1),
                     "torsoAngleAfter": round(obs[k].torso_angle, 1), "observationCount": m - k + 1},
                    f"Tracked person changed from an upright to a lying posture within {obs[k].t - up.t:.1f} seconds "
                    f"and stayed in a lying posture for approximately {lying:.1f} seconds."))
            i = m + 1
        else:
            i = max(j, i + 1)
    return events
