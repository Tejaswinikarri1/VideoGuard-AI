package com.videoguard.analysis;

import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.common.Ids;
import com.videoguard.common.PageResult;
import com.videoguard.events.Event;
import com.videoguard.security.AuthUser;
import com.videoguard.users.User;
import com.videoguard.users.UserRepository;
import com.videoguard.videos.AccessService;
import com.videoguard.videos.Video;
import com.videoguard.zones.PolygonValidator;
import com.videoguard.zones.Zone;
import com.videoguard.zones.ZoneRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

@Service
public class AnalysisService {
    private final AnalysisRepository repo; private final MongoTemplate t; private final AccessService access;
    private final ZoneRepository zones; private final AuditService audit; private final UserRepository users;

    public AnalysisService(AnalysisRepository repo, MongoTemplate t, AccessService access, ZoneRepository zones, AuditService audit, UserRepository users) {
        this.repo = repo; this.t = t; this.access = access; this.zones = zones; this.audit = audit; this.users = users;
    }

    public AnalysisDto create(AuthUser u, String videoId, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 100) throw ApiException.invalid("Idempotency-Key header is required.");
        Video v = access.video(u, videoId);
        Optional<AnalysisJob> existing = repo.findByRequestedByAndIdempotencyKey(u.id(), idempotencyKey);
        if (existing.isPresent()) return dto(existing.get());
        if (!"COMPLETED".equals(v.metadataStatus)) throw ApiException.invalid("Video metadata is not available; analysis cannot start.");
        boolean active = t.exists(Query.query(new Criteria().andOperator(Criteria.where("videoId").is(videoId), Criteria.where("status").in("QUEUED", "RUNNING"))), AnalysisJob.class);
        if (active) throw new ApiException(HttpStatus.CONFLICT, "ANALYSIS_ALREADY_RUNNING", "An analysis for this video is already queued or running.");

        AnalysisJob j = new AnalysisJob();
        j.id = Ids.uuid(); j.videoId = videoId; j.requestedBy = u.id(); j.idempotencyKey = idempotencyKey;
        for (Zone z : zones.findByVideoIdOrderByCreatedAtAsc(videoId)) {
            if (z.enabled && PolygonValidator.validate(z.polygon).isEmpty())
                j.zones.add(Map.of("id", z.id, "name", z.name, "polygon", z.polygon, "enabled", true));
        }
        try { repo.save(j); }
        catch (DuplicateKeyException e) { return dto(repo.findByRequestedByAndIdempotencyKey(u.id(), idempotencyKey).orElseThrow()); }
        audit.record(u, "START_ANALYSIS", "Start Analysis", "ANALYSIS", j.id, true, "Started analysis for video " + videoId + " with " + j.zones.size() + " restricted zone(s)");
        return dto(j);
    }

    public AnalysisDto get(AuthUser u, String id) {
        AnalysisJob j = repo.findById(id).orElseThrow(ApiException::notFound);
        access.video(u, j.videoId);
        return dto(j);
    }

    public List<AnalysisDto> forVideo(AuthUser u, String videoId) {
        access.video(u, videoId);
        return t.find(Query.query(Criteria.where("videoId").is(videoId)).with(Sort.by(Sort.Direction.DESC, "createdAt")), AnalysisJob.class).stream().map(this::dto).toList();
    }

    public PageResult<AnalysisDto> list(AuthUser u, String status, int page, int size) {
        size = PageResult.clampSize(size); page = Math.max(page, 0);
        List<String> ids = access.accessibleVideoIds(u);
        if (ids.isEmpty()) return new PageResult<>(List.of(), 0, page, size);
        List<Criteria> and = new ArrayList<>(List.of(Criteria.where("videoId").in(ids)));
        if ("ACTIVE".equalsIgnoreCase(status)) and.add(Criteria.where("status").in("QUEUED", "RUNNING"));
        else if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) and.add(Criteria.where("status").is(status.toUpperCase()));
        Query q = Query.query(new Criteria().andOperator(and));
        long total = t.count(q, AnalysisJob.class);
        List<AnalysisJob> jobs = t.find(q.with(Sort.by(Sort.Direction.DESC, "createdAt")).skip((long) page * size).limit(size), AnalysisJob.class);
        return new PageResult<>(jobs.stream().map(this::dto).toList(), total, page, size);
    }

    public List<String> logs(AuthUser u, String id) { return get(u, id) == null ? List.of() : repo.findById(id).orElseThrow(ApiException::notFound).logs; }

    public AnalysisDto cancel(AuthUser u, String id) {
        AnalysisJob j = repo.findById(id).orElseThrow(ApiException::notFound);
        Video v = access.video(u, j.videoId);
        if (!j.requestedBy.equals(u.id()) && !v.ownerId.equals(u.id())) throw ApiException.forbidden();
        // QUEUED jobs are cancelled atomically; RUNNING jobs are flagged and the worker stops the AI job.
        var res = t.updateFirst(Query.query(new Criteria().andOperator(Criteria.where("_id").is(id), Criteria.where("status").is("QUEUED"))),
                new Update().set("status", "CANCELLED").set("completedAt", Instant.now()), AnalysisJob.class);
        if (res.getModifiedCount() == 0)
            t.updateFirst(Query.query(new Criteria().andOperator(Criteria.where("_id").is(id), Criteria.where("status").is("RUNNING"))),
                    new Update().set("cancelRequested", true), AnalysisJob.class);
        audit.record(u, "CANCEL_ANALYSIS", "Cancel Analysis", "ANALYSIS", id, true, null);
        return dto(repo.findById(id).orElseThrow(ApiException::notFound));
    }

    /** CSV of events; cells starting with =,+,-,@ are prefixed to prevent spreadsheet formula injection. */
    public String exportCsv(AuthUser u, String id) {
        AnalysisJob j = repo.findById(id).orElseThrow(ApiException::notFound);
        Video v = access.video(u, j.videoId);
        StringBuilder sb = new StringBuilder("event_id,video,event_type,start_seconds,end_seconds,confidence,severity,review_status,track_id,description\n");
        for (Event e : t.find(Query.query(Criteria.where("analysisId").is(id)).with(Sort.by("startTimeSeconds")), Event.class))
            sb.append(String.join(",", cell(e.id), cell(v.originalFilename), cell(e.eventType), String.valueOf(e.startTimeSeconds), String.valueOf(e.endTimeSeconds),
                    String.format(Locale.ROOT, "%.3f", e.confidence), cell(e.severity), cell(e.reviewStatus), e.trackId == null ? "" : String.valueOf(e.trackId), cell(e.description))).append('\n');
        return sb.toString();
    }

    public static String cell(String s) {
        if (s == null) return "";
        String x = s.replace("\"", "\"\"");
        if (!x.isEmpty() && "=+-@".indexOf(x.charAt(0)) >= 0) x = "'" + x;
        return "\"" + x + "\"";
    }

    public AnalysisDto dto(AnalysisJob j) {
        Video v = t.findById(j.videoId, Video.class);
        User req = users.findById(j.requestedBy).orElse(null);
        Map<String, Long> summary = new LinkedHashMap<>();
        if ("COMPLETED".equals(j.status)) {
            List<Event> evs = t.find(Query.query(Criteria.where("analysisId").is(j.id)), Event.class);
            summary.put("total", (long) evs.size());
            summary.put("confirmed", evs.stream().filter(e -> "CONFIRMED".equals(e.reviewStatus)).count());
            summary.put("pending", evs.stream().filter(e -> "PENDING".equals(e.reviewStatus)).count());
            summary.put("highSeverity", evs.stream().filter(e -> "HIGH".equals(e.severity)).count());
        }
        return new AnalysisDto(j.id, j.videoId, v == null ? null : v.originalFilename, v == null ? null : v.durationSeconds, v == null ? null : v.width,
                v == null ? null : v.height, v == null ? null : v.frameRate, v == null ? 0 : v.sizeBytes, j.requestedBy, req == null ? null : req.displayName,
                j.status, j.stage, j.progressPercent, j.stageProgressPercent, j.pipelineVersion, j.modelVersion, j.attempt, j.createdAt, j.startedAt,
                j.completedAt, j.errorCode, j.errorMessage, j.eventCount, j.zones.size(), j.stageTimings, summary);
    }
}
