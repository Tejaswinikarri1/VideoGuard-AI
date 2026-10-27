package com.videoguard.analysis;

import com.videoguard.common.Ids;
import com.videoguard.events.Event;

import java.util.*;

/** Everything the AI service returns is untrusted: validated, bounded, and forced to PENDING before persistence. */
public final class AiResultValidator {
    private AiResultValidator() {}
    public static final Set<String> TYPES = Set.of("PERSON_LOITERING", "SUDDEN_RUNNING", "RESTRICTED_AREA_INTRUSION", "WEAPON_DETECTION", "FALL_DETECTED");
    public static final Set<String> SEVERITIES = Set.of("LOW", "MEDIUM", "HIGH");
    public static final Set<String> STAGES = Set.of("JOB_ACCEPTED", "PREPARING_VIDEO", "FRAME_SAMPLING", "OBJECT_DETECTION", "OBJECT_TRACKING",
            "ACTIVITY_ANALYSIS", "EVENT_CORRELATION", "EVIDENCE_GENERATION", "PERSISTING_RESULTS", "COMPLETED");

    static Double num(Object o) {
        if (o instanceof Number n && Double.isFinite(n.doubleValue())) return n.doubleValue();
        return null;
    }

    /** Returns a ready-to-save Event or empty if the candidate is invalid. */
    @SuppressWarnings("unchecked")
    public static Optional<Event> event(String analysisId, String videoId, double videoDuration, String ruleVersion, Map<String, Object> m) {
        try {
            String type = String.valueOf(m.get("eventType")), sev = String.valueOf(m.get("severity"));
            Double s = num(m.get("startTimeSeconds")), e = num(m.get("endTimeSeconds")), c = num(m.get("confidence"));
            if (!TYPES.contains(type) || !SEVERITIES.contains(sev) || s == null || e == null || c == null) return Optional.empty();
            if (c < 0 || c > 1 || s < 0 || e < s || e > videoDuration + 1.0) return Optional.empty();
            String desc = String.valueOf(m.getOrDefault("description", "")).trim();
            if (desc.isEmpty()) return Optional.empty();
            Integer track = m.get("trackId") instanceof Number n ? n.intValue() : null;

            Event ev = new Event();
            ev.analysisId = analysisId; ev.videoId = videoId; ev.trackId = track; ev.eventType = type;
            ev.startTimeSeconds = s; ev.endTimeSeconds = e; ev.confidence = c; ev.severity = sev;
            ev.description = desc.substring(0, Math.min(desc.length(), 300));
            ev.ruleVersion = ruleVersion;
            ev.reviewStatus = "PENDING"; // never taken from the AI payload
            ev.zoneId = m.get("zoneId") == null ? null : String.valueOf(m.get("zoneId"));
            String key = Ids.sha1(analysisId + "|" + type + "|" + track + "|" + Math.round(s * 100) + "|" + ev.zoneId);
            ev.id = key; ev.dedupeKey = key;

            Object meas = m.get("measurements");
            if (meas instanceof Map<?, ?> mm && mm.size() <= 30) {
                Map<String, Object> clean = new LinkedHashMap<>();
                mm.forEach((k, v) -> { if (v instanceof Number || v instanceof String || v instanceof Boolean) clean.put(String.valueOf(k), v); });
                ev.measurements = clean;
            }
            Object traj = m.get("trajectory");
            if (traj instanceof List<?> tl && tl.size() <= 120) {
                List<List<Double>> out = new ArrayList<>();
                for (Object row : tl) {
                    if (!(row instanceof List<?> r) || r.size() != 5) continue;
                    List<Double> vals = new ArrayList<>();
                    for (Object x : r) { Double d = num(x); if (d == null) break; vals.add(d); }
                    if (vals.size() == 5) out.add(vals);
                }
                ev.trajectory = out;
            }
            String ek = m.get("evidenceKey") == null ? null : String.valueOf(m.get("evidenceKey"));
            if (ek != null && ek.startsWith(analysisId + "/") && !ek.contains("..") && !ek.contains("\\")) { ev.evidenceStorageKey = ek; ev.evidenceStatus = "AVAILABLE"; }
            else ev.evidenceStatus = "FAILED";
            return Optional.of(ev);
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }
}
