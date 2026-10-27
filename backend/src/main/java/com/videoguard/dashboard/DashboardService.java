package com.videoguard.dashboard;

import com.videoguard.analysis.AnalysisJob;
import com.videoguard.analysis.AnalysisService;
import com.videoguard.config.AppProperties;
import com.videoguard.events.Event;
import com.videoguard.events.EventService;
import com.videoguard.security.AuthUser;
import com.videoguard.videos.AccessService;
import com.videoguard.videos.Video;
import com.videoguard.videos.VideoService;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/** All numbers are computed from stored data of resources the caller may access. Nothing is sample data. */
@Service
public class DashboardService {
    private final MongoTemplate t; private final AccessService access; private final VideoService videos;
    private final AnalysisService analyses; private final EventService events; private final AppProperties props;

    public DashboardService(MongoTemplate t, AccessService access, VideoService videos, AnalysisService analyses, EventService events, AppProperties props) {
        this.t = t; this.access = access; this.videos = videos; this.analyses = analyses; this.events = events; this.props = props;
    }

    static Double delta(long current, long previous) { return previous == 0 ? null : Math.round((current - previous) * 1000.0 / previous) / 10.0; }

    public Map<String, Object> summary(AuthUser u, int days) {
        days = days <= 7 ? 7 : days <= 30 ? 30 : 90;
        Instant now = Instant.now(), from = now.minus(days, ChronoUnit.DAYS), prev = from.minus(days, ChronoUnit.DAYS);
        List<Video> vids = t.find(Query.query(access.accessibleVideos(u)), Video.class);
        List<String> ids = vids.stream().map(v -> v.id).toList();
        List<AnalysisJob> jobs = ids.isEmpty() ? List.of() : t.find(Query.query(Criteria.where("videoId").in(ids)), AnalysisJob.class);
        List<Event> evs = ids.isEmpty() ? List.of() : t.find(Query.query(Criteria.where("videoId").in(ids)), Event.class);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totalVideos", stat(vids.size(), vids.stream().filter(v -> v.createdAt.isAfter(from)).count(), vids.stream().filter(v -> v.createdAt.isAfter(prev) && !v.createdAt.isAfter(from)).count(), trend(vids.stream().map(v -> v.createdAt), from, now)));
        m.put("totalAnalyses", stat(jobs.size(), jobs.stream().filter(j -> j.createdAt.isAfter(from)).count(), jobs.stream().filter(j -> j.createdAt.isAfter(prev) && !j.createdAt.isAfter(from)).count(), trend(jobs.stream().map(j -> j.createdAt), from, now)));
        m.put("detectedEvents", stat(evs.size(), evs.stream().filter(e -> e.createdAt.isAfter(from)).count(), evs.stream().filter(e -> e.createdAt.isAfter(prev) && !e.createdAt.isAfter(from)).count(), trend(evs.stream().map(e -> e.createdAt), from, now)));
        long pending = evs.stream().filter(e -> "PENDING".equals(e.reviewStatus)).count();
        m.put("pendingReviews", stat(pending, evs.stream().filter(e -> "PENDING".equals(e.reviewStatus) && e.createdAt.isAfter(from)).count(),
                evs.stream().filter(e -> "PENDING".equals(e.reviewStatus) && e.createdAt.isAfter(prev) && !e.createdAt.isAfter(from)).count(), trend(evs.stream().filter(e -> "PENDING".equals(e.reviewStatus)).map(e -> e.createdAt), from, now)));

        List<Event> inRange = evs.stream().filter(e -> e.createdAt.isAfter(from)).toList();
        m.put("eventTypes", inRange.stream().collect(Collectors.groupingBy(e -> e.eventType, TreeMap::new, Collectors.counting())));
        m.put("severityTotals", inRange.stream().collect(Collectors.groupingBy(e -> e.severity, TreeMap::new, Collectors.counting())));

        Map<LocalDate, Map<String, Long>> byDay = new TreeMap<>();
        for (int i = days - 1; i >= 0; i--) byDay.put(LocalDate.now(ZoneOffset.UTC).minusDays(i), new HashMap<>());
        for (Event e : inRange) {
            Map<String, Long> d = byDay.get(e.createdAt.atZone(ZoneOffset.UTC).toLocalDate());
            if (d != null) d.merge(e.severity, 1L, Long::sum);
        }
        List<Map<String, Object>> series = new ArrayList<>();
        byDay.forEach((day, c) -> series.add(Map.of("date", day.toString(), "HIGH", c.getOrDefault("HIGH", 0L), "MEDIUM", c.getOrDefault("MEDIUM", 0L), "LOW", c.getOrDefault("LOW", 0L))));
        m.put("series", series);

        m.put("recentVideos", videos.list(u, null, null, null, 0, 5).items());
        m.put("activeJobs", analyses.list(u, "ACTIVE", 0, 5).items());
        m.put("recentJobs", analyses.list(u, "ALL", 0, 5).items());
        m.put("recentEvents", events.search(u, null, null, null, null, 0, 5).items());
        m.put("storage", Map.of("usedBytes", vids.stream().mapToLong(v -> v.sizeBytes).sum(), "quotaBytes", props.quotaGb() * 1024L * 1024L * 1024L));
        m.put("days", days);
        return m;
    }

    private static Map<String, Object> stat(long value, long cur, long prev, List<Long> trend) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("value", value); s.put("deltaPercent", delta(cur, prev)); s.put("trend", trend);
        return s;
    }

    /** Counts per equal time bucket across the window (real data for the stat-card mini bars). */
    static List<Long> trend(java.util.stream.Stream<Instant> times, Instant from, Instant now) {
        long span = Math.max(1, java.time.Duration.between(from, now).toSeconds());
        long[] b = new long[7];
        times.forEach(t -> { if (t.isAfter(from) && !t.isAfter(now)) b[(int) Math.min(6, java.time.Duration.between(from, t).toSeconds() * 7 / span)]++; });
        return java.util.Arrays.stream(b).boxed().toList();
    }
}
