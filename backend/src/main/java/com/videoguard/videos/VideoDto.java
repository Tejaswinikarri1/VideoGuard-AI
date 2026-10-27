package com.videoguard.videos;

import java.time.Instant;

/** Public view: never exposes storage keys or filesystem paths. */
public record VideoDto(String id, String ownerId, String ownerName, String ownerEmail, String filename, String format,
                       String codec, long sizeBytes, Double durationSeconds, Integer width, Integer height, Double frameRate,
                       String metadataStatus, String metadataError, String description, String location, int frameCount,
                       Instant createdAt, int analysisCount, String latestAnalysisStatus, String latestAnalysisId) {
    public static VideoDto of(Video v, String ownerName, String ownerEmail, int analysisCount, String latestStatus, String latestId) {
        String ext = v.originalFilename.contains(".") ? v.originalFilename.substring(v.originalFilename.lastIndexOf('.') + 1).toUpperCase() : "";
        return new VideoDto(v.id, v.ownerId, ownerName, ownerEmail, v.originalFilename, ext, v.codec, v.sizeBytes, v.durationSeconds,
                v.width, v.height, v.frameRate, v.metadataStatus, v.metadataError, v.description, v.location, v.frameKeys.size(),
                v.createdAt, analysisCount, latestStatus, latestId);
    }
}
