package com.videoguard.config;

import com.videoguard.analysis.AiClient;
import com.videoguard.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/config")
public class ConfigController {
    private final AppProperties p;
    private final AiClient ai;
    public ConfigController(AppProperties p, AiClient ai) { this.p = p; this.ai = ai; }

    /** Coarse health for the sidebar footer. Reveals no internals. */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> status() {
        String aiState;
        try { aiState = Boolean.TRUE.equals(ai.health().get("detectorLoaded")) ? "UP" : "DEGRADED"; } catch (RuntimeException e) { aiState = "DOWN"; }
        return ApiResponse.ok(Map.of("backend", "UP", "aiService", aiState, "version", "1.0.0"));
    }

    @GetMapping
    public ApiResponse<Map<String, Object>> get() {
        return ApiResponse.ok(Map.of("maxUploadBytes", p.maxUploadMb() * 1024L * 1024L, "maxDurationSeconds", p.maxDurationSeconds(),
                "formats", List.of("MP4", "MOV", "AVI", "MKV", "WEBM"), "storageQuotaBytes", p.quotaGb() * 1024L * 1024L * 1024L));
    }
}
