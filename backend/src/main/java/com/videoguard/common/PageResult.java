package com.videoguard.common;

import java.util.List;

public record PageResult<T>(List<T> items, long total, int page, int size) {
    public static int clampSize(int size) { return Math.min(Math.max(size, 1), 100); }
}
