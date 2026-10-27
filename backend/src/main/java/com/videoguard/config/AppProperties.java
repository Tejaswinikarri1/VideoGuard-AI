package com.videoguard.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String frontendOrigin, String jwtSecret, int jwtTtlMinutes, int mediaTokenTtlSeconds,
        String videoRoot, String evidenceRoot, int maxUploadMb, int maxDurationSeconds,
        String aiServiceUrl, String aiServiceToken, int workerThreads, int jobLeaseSeconds, int maxJobAttempts,
        String bootstrapAdminEmail, String bootstrapAdminPassword, String ffmpegBin, String ffprobeBin,
        Integer storageQuotaGb) {
    public int quotaGb() { return storageQuotaGb == null ? 100 : storageQuotaGb; }
}
