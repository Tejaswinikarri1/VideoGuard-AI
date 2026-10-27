from app.config import Settings
from app.geometry import point_in_polygon, validate_polygon
from app.schemas import CandidateEvent, Track


def detect_intrusion(track: Track, zones: list[dict], s: Settings) -> list[CandidateEvent]:
    """zones: [{"id": str, "name": str, "polygon": [[x,y],...], "enabled": bool}] in normalized coords.
    Invalid or disabled zones are skipped. Requires N consecutive inside observations (boundary-noise filter)."""
    obs = sorted(track.observations, key=lambda o: o.t)
    events: list[CandidateEvent] = []
    for z in zones:
        poly = [tuple(p) for p in z.get("polygon", [])]
        if not z.get("enabled", True) or validate_polygon(poly):
            continue
        inside = [point_in_polygon(o.foot, poly) for o in obs]
        k = 0
        while k < len(obs):
            if not inside[k]:
                k += 1
                continue
            m = k
            while m + 1 < len(obs) and inside[m + 1]:
                m += 1
            if m - k + 1 >= s.intrusion_min_inside_observations:
                conf = sum(o.conf for o in obs[k:m + 1]) / (m - k + 1)
                events.append(CandidateEvent(
                    "RESTRICTED_AREA_INTRUSION", track.track_id, obs[k].t, obs[m].t, conf,
                    {"zoneId": z["id"], "entryTimestamp": obs[k].t, "lastInsideTimestamp": obs[m].t,
                     "insideObservations": m - k + 1},
                    f"Tracked {track.class_name} entered restricted zone \"{z.get('name', z['id'])}\" "
                    f"at {obs[k].t:.1f} seconds.", zone_id=z["id"]))
            k = m + 1
    return events
