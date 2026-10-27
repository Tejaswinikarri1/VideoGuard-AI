package com.videoguard.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.videoguard.common.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory sliding window limiter (single instance). Replace with a shared store when scaling out. */
/** Not a Spring bean on purpose: it is constructed in SecurityConfig so it only runs inside the security filter chain. */
public class RateLimitFilter extends OncePerRequestFilter {
    private final ConcurrentHashMap<String, Deque<Long>> hits = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    static int limitFor(HttpServletRequest r) {
        String p = r.getRequestURI(), m = r.getMethod();
        if (!"POST".equals(m)) return 0;
        if (p.endsWith("/auth/login") || p.endsWith("/auth/register") || p.endsWith("/auth/password")) return 10;
        if (p.endsWith("/analyses") || p.endsWith("/videos")) return 30;
        return 0;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        int limit = limitFor(req);
        if (limit > 0) {
            String key = req.getRequestURI() + "|" + req.getRemoteAddr();
            long now = System.currentTimeMillis();
            Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
            synchronized (q) {
                while (!q.isEmpty() && now - q.peekFirst() > 60_000) q.pollFirst();
                if (q.size() >= limit) {
                    res.setStatus(429);
                    res.setContentType("application/json");
                    mapper.writeValue(res.getOutputStream(), ApiResponse.fail("RATE_LIMITED", "Too many requests. Please wait a moment."));
                    return;
                }
                q.addLast(now);
            }
        }
        chain.doFilter(req, res);
    }
}
