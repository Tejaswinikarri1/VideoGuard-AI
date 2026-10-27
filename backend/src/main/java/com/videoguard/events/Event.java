package com.videoguard.events;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document("events")
public class Event {
    @Id public String id;
    public String dedupeKey;
    public String analysisId;
    public String videoId;
    public Integer trackId;
    public String eventType;
    public double startTimeSeconds;
    public double endTimeSeconds;
    public double confidence;
    public String severity;          // LOW | MEDIUM | HIGH (prioritisation aid only)
    public String description;
    public String evidenceStorageKey;
    public String evidenceStatus;    // AVAILABLE | FAILED
    public String reviewStatus = "PENDING"; // only a human review may change this
    public String ruleVersion;
    public Map<String, Object> measurements;
    public String zoneId;
    public List<List<Double>> trajectory = new ArrayList<>(); // [t,x1,y1,x2,y2] normalized
    public Instant createdAt = Instant.now();
}
