package com.videoguard.analysis;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record AnalysisDto(String id, String videoId, String videoName, Double videoDuration, Integer videoWidth, Integer videoHeight,
                          Double videoFrameRate, long videoSizeBytes, String requestedBy, String requestedByName, String status,
                          String stage, int progressPercent, int stageProgressPercent, String pipelineVersion, String modelVersion,
                          int attempt, Instant createdAt, Instant startedAt, Instant completedAt, String errorCode, String errorMessage,
                          int eventCount, int zoneCount, List<Map<String, Object>> stageTimings, Map<String, Long> eventSummary) {}
