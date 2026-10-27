package com.videoguard.events;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record EventDto(String id, String analysisId, String videoId, String videoName, String videoLocation, Integer trackId, String eventType,
                       double startTimeSeconds, double endTimeSeconds, double confidence, String severity, String description,
                       boolean hasEvidence, String evidenceStatus, String reviewStatus, String ruleVersion,
                       Map<String, Object> measurements, String zoneId, List<List<Double>> trajectory, Instant createdAt,
                       String lastReviewer, String lastReviewNotes, Instant lastReviewedAt) {
    public static EventDto of(Event e, String videoName, String videoLocation, Review last) {
        return new EventDto(e.id, e.analysisId, e.videoId, videoName, videoLocation, e.trackId, e.eventType, e.startTimeSeconds, e.endTimeSeconds,
                e.confidence, e.severity, e.description, e.evidenceStorageKey != null && "AVAILABLE".equals(e.evidenceStatus),
                e.evidenceStatus, e.reviewStatus, e.ruleVersion, e.measurements, e.zoneId, e.trajectory, e.createdAt,
                last == null ? null : last.reviewerName, last == null ? null : last.notes, last == null ? null : last.createdAt);
    }
}
