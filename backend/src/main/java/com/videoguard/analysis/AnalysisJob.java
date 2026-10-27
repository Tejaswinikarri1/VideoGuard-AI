package com.videoguard.analysis;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Document("analysis_jobs")
public class AnalysisJob {
    @Id public String id;
    public String videoId;
    public String requestedBy;
    public String idempotencyKey;
    public String status = "QUEUED";       // QUEUED | RUNNING | COMPLETED | FAILED | CANCELLED
    public String stage = "JOB_ACCEPTED";
    public int progressPercent = 0;
    public int stageProgressPercent = 0;
    public String pipelineVersion;
    public String modelVersion;
    public int attempt = 0;
    public boolean cancelRequested = false;
    public Instant leaseUntil;
    public Instant createdAt = Instant.now();
    public Instant startedAt;
    public Instant completedAt;
    public String errorCode;
    public String errorMessage;
    public int eventCount = 0;
    public List<Map<String, Object>> zones = new ArrayList<>();        // snapshot of enabled zones at creation time
    public List<Map<String, Object>> stageTimings = new ArrayList<>(); // [{stage, startedAt, completedAt}] reported by the AI service
    public List<String> logs = new ArrayList<>();
}
