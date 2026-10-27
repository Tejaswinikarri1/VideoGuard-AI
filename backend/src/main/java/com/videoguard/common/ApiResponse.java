package com.videoguard.common;

import org.slf4j.MDC;

public record ApiResponse<T>(T data, ApiError error, String requestId) {
    public record ApiError(String code, String message) {}
    public static <T> ApiResponse<T> ok(T data) { return new ApiResponse<>(data, null, MDC.get("requestId")); }
    public static ApiResponse<Void> fail(String code, String message) {
        return new ApiResponse<>(null, new ApiError(code, message), MDC.get("requestId"));
    }
}
