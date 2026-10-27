package com.videoguard.events;

import com.videoguard.analysis.AnalysisJob;
import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.common.Ids;
import com.videoguard.common.PageResult;
import com.videoguard.security.AuthUser;
import com.videoguard.videos.AccessService;
import com.videoguard.videos.Video;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class EventService {
    private static final Logger log = LoggerFactory.getLogger(EventService.class);
    public record ReviewRequest(@NotNull String decision, @Size(max = 500) String notes) {}
    public static final Set<String> DECISIONS = Set.of("CONFIRMED", "REJECTED", "UNCERTAIN");
    public static final Map<String, String> LABELS = Map.of("PERSON_LOITERING", "Person Loitering", "SUDDEN_RUNNING", "Sudden Running",
            "RESTRICTED_AREA_INTRUSION", "Restricted Area Intrusion", "WEAPON_DETECTION", "Weapon Detection", "FALL_DETECTED", "Fall Detected");

    private final MongoTemplate t; private final EventRepository events; private final ReviewRepository reviews;
    private final AccessService access; private final AuditService audit;

    public EventService(MongoTemplate t, EventRepository events, ReviewRepository reviews, AccessService access, AuditService audit) {
        this.t = t; this.events = events; this.reviews = reviews; this.access = access; this.audit = audit;
    }

    /** Events for one analysis. Access is derived from the analysis' video. */
    public List<EventDto> forAnalysis(AuthUser u, String analysisId, String type, String severity, String status, String q) {
        AnalysisJob job = t.findById(analysisId, AnalysisJob.class);
        if (job == null) throw ApiException.notFound();
        Video v = access.video(u, job.videoId);
        List<Criteria> and = new ArrayList<>(List.of(Criteria.where("analysisId").is(analysisId)));
        addFilters(and, type, severity, status, q);
        List<Event> list = t.find(Query.query(new Criteria().andOperator(and)).with(Sort.by("startTimeSeconds")), Event.class);
        return toDtos(list, Map.of(v.id, v));
    }

    /** Events across every video the user can access (pending-review queue). */
    public PageResult<EventDto> search(AuthUser u, String type, String severity, String status, String q, int page, int size) {
        size = PageResult.clampSize(size); page = Math.max(page, 0);
        Map<String, Video> names = t.find(Query.query(access.accessibleVideos(u)), Video.class).stream().collect(Collectors.toMap(v -> v.id, v -> v));
        if (names.isEmpty()) return new PageResult<>(List.of(), 0, page, size);
        List<Criteria> and = new ArrayList<>(List.of(Criteria.where("videoId").in(names.keySet())));
        addFilters(and, type, severity, status, null);
        if (q != null && !q.isBlank()) {
            String rx = Pattern.quote(q.trim());
            List<String> byName = names.entrySet().stream().filter(e -> e.getValue().originalFilename.toLowerCase().contains(q.trim().toLowerCase()) || (e.getValue().location != null && e.getValue().location.toLowerCase().contains(q.trim().toLowerCase()))).map(Map.Entry::getKey).toList();
            and.add(new Criteria().orOperator(Criteria.where("description").regex(rx, "i"), Criteria.where("eventType").regex(rx, "i"), Criteria.where("videoId").in(byName)));
        }
        Query query = Query.query(new Criteria().andOperator(and));
        long total = t.count(query, Event.class);
        List<Event> list = t.find(query.with(Sort.by(Sort.Direction.DESC, "createdAt")).skip((long) page * size).limit(size), Event.class);
        return new PageResult<>(toDtos(list, names), total, page, size);
    }

    private void addFilters(List<Criteria> and, String type, String severity, String status, String q) {
        if (type != null && !type.isBlank() && !"ALL".equalsIgnoreCase(type)) and.add(Criteria.where("eventType").is(type));
        if (severity != null && !severity.isBlank() && !"ALL".equalsIgnoreCase(severity)) and.add(Criteria.where("severity").is(severity));
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) and.add(Criteria.where("reviewStatus").is(status));
        if (q != null && !q.isBlank()) and.add(Criteria.where("description").regex(Pattern.quote(q.trim()), "i"));
    }

    public long pendingCount(AuthUser u) {
        List<String> ids = access.accessibleVideoIds(u);
        if (ids.isEmpty()) return 0;
        return t.count(Query.query(new Criteria().andOperator(Criteria.where("videoId").in(ids), Criteria.where("reviewStatus").is("PENDING"))), Event.class);
    }

    public EventDto get(AuthUser u, String id) {
        Event e = events.findById(id).orElseThrow(ApiException::notFound);
        Video v = access.video(u, e.videoId);
        return toDtos(List.of(e), Map.of(v.id, v)).get(0);
    }

    public List<Review> history(AuthUser u, String eventId) {
        Event e = events.findById(eventId).orElseThrow(ApiException::notFound);
        access.video(u, e.videoId);
        return reviews.findByEventIdOrderByCreatedAtDesc(eventId);
    }

    /** Persist the event status and review history with compensation if the second write fails. */
    public EventDto review(AuthUser u, String eventId, ReviewRequest r) {
        if (!DECISIONS.contains(r.decision())) throw ApiException.invalid("Decision must be CONFIRMED, REJECTED or UNCERTAIN.");
        Event e = events.findById(eventId).orElseThrow(ApiException::notFound);
        Video v = access.video(u, e.videoId);
        Review rv = new Review();
        rv.id = Ids.uuid(); rv.eventId = eventId; rv.reviewerId = u.id(); rv.reviewerName = u.displayName();
        rv.decision = r.decision(); rv.notes = r.notes() == null || r.notes().isBlank() ? null : r.notes().trim(); rv.createdAt = Instant.now();
        String previousStatus = e.reviewStatus;
        e.reviewStatus = r.decision();
        events.save(e);
        try {
            reviews.save(rv);
        } catch (RuntimeException failure) {
            e.reviewStatus = previousStatus;
            try {
                events.save(e);
            } catch (RuntimeException rollbackFailure) {
                log.error("Failed to restore event {} after review history save failed", eventId, rollbackFailure);
                throw new IllegalStateException("The review could not be saved and the event status could not be restored.", failure);
            }
            throw failure;
        }
        audit.record(u, "REVIEW_EVENT", "Review Event", "EVENT", eventId, true,
                "Event " + r.decision().toLowerCase() + ": " + LABELS.getOrDefault(e.eventType, e.eventType) + " at " + String.format("%.1f", e.startTimeSeconds) + "s (confidence: " + Math.round(e.confidence * 100) + "%)");
        return toDtos(List.of(e), Map.of(v.id, v)).get(0);
    }

    private List<EventDto> toDtos(List<Event> list, Map<String, Video> names) {
        if (list.isEmpty()) return List.of();
        Map<String, Review> last = new HashMap<>();
        for (Review r : t.find(Query.query(Criteria.where("eventId").in(list.stream().map(e -> e.id).toList())).with(Sort.by(Sort.Direction.DESC, "createdAt")), Review.class))
            last.putIfAbsent(r.eventId, r);
        return list.stream().map(e -> { Video v = names.get(e.videoId); return EventDto.of(e, v == null ? null : v.originalFilename, v == null ? null : v.location, last.get(e.id)); }).toList();
    }
}
