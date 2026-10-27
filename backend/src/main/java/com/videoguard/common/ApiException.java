package com.videoguard.common;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    public final HttpStatus status;
    public final String code;
    public ApiException(HttpStatus status, String code, String message) { super(message); this.status = status; this.code = code; }
    public static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "Resource not found."); }
    public static ApiException forbidden() { return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You do not have permission to perform this action."); }
    public static ApiException invalid(String msg) { return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", msg); }
}
