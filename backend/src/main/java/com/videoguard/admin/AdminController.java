package com.videoguard.admin;

import com.videoguard.analysis.AiClient;
import com.videoguard.analysis.AnalysisDto;
import com.videoguard.analysis.AnalysisJob;
import com.videoguard.analysis.AnalysisService;
import com.videoguard.audit.AuditLog;
import com.videoguard.common.ApiResponse;
import com.videoguard.common.PageResult;
import com.videoguard.config.AppProperties;
import com.videoguard.security.CurrentUser;
import com.videoguard.users.UserDto;
import com.videoguard.videos.Video;
import jakarta.validation.Valid;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

/** Every route here requires ADMIN; ownership checks still apply to video content (admins get no implicit video access). */
@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private final AdminUserService users; private final MongoTemplate t; private final AnalysisService analyses; private final AiClient ai; private final AppProperties props;

    public AdminController(AdminUserService users, MongoTemplate t, AnalysisService analyses, AiClient ai, AppProperties props) {
        this.users = users; this.t = t; this.analyses = analyses; this.ai = ai; this.props = props;
    }

    // ---- users ----
    @GetMapping("/users")
    public ApiResponse<PageResult<UserDto>> users(@RequestParam(required = false) String q, @RequestParam(required = false) String role, @RequestParam(required = false) String status,
                                                  @RequestParam(required = false) String sort, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "8") int size) {
        return ApiResponse.ok(users.list(q, role, status, sort, page, size));
    }
    @PostMapping("/users") @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<UserDto> create(@Valid @RequestBody AdminUserService.CreateUser r) { return ApiResponse.ok(users.create(CurrentUser.require(), r)); }
    @PatchMapping("/users/{id}")
    public ApiResponse<UserDto> update(@PathVariable String id, @Valid @RequestBody AdminUserService.UpdateUser r) { return ApiResponse.ok(users.update(CurrentUser.require(), id, r)); }
    @PatchMapping("/users/{id}/roles")
    public ApiResponse<UserDto> roles(@PathVariable String id, @RequestBody Map<String, List<String>> body) {
        return ApiResponse.ok(users.update(CurrentUser.require(), id, new AdminUserService.UpdateUser(body.get("roles"), null, null, null)));
    }
    @PatchMapping("/users/{id}/status")
    public ApiResponse<UserDto> status(@PathVariable String id, @RequestBody Map<String, Boolean> body) {
        return ApiResponse.ok(users.update(CurrentUser.require(), id, new AdminUserService.UpdateUser(null, body.get("active"), null, null)));
    }

    // ---- audit logs ----
    private Query auditQuery(String from, String to, String actor, String action, String outcome, String resourceType, String resourceId) {
        List<Criteria> and = new ArrayList<>();
        if (from != null && !from.isBlank()) and.add(Criteria.where("createdAt").gte(LocalDate.parse(from).atStartOfDay().toInstant(ZoneOffset.UTC)));
        if (to != null && !to.isBlank()) and.add(Criteria.where("createdAt").lt(LocalDate.parse(to).plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC)));
        if (actor != null && !actor.isBlank()) and.add(Criteria.where("actorUserId").is(actor));
        if (action != null && !action.isBlank()) and.add(Criteria.where("action").is(action));
        if (outcome != null && !outcome.isBlank()) and.add(Criteria.where("outcome").is(outcome));
        if (resourceType != null && !resourceType.isBlank()) and.add(Criteria.where("resourceType").is(resourceType));
        if (resourceId != null && !resourceId.isBlank()) and.add(Criteria.where("resourceId").regex("^" + java.util.regex.Pattern.quote(resourceId.trim())));
        return and.isEmpty() ? new Query() : Query.query(new Criteria().andOperator(and));
    }

    @GetMapping("/audit-logs")
    public ApiResponse<PageResult<AuditLog>> audit(@RequestParam(required = false) String from, @RequestParam(required = false) String to, @RequestParam(required = false) String actor,
                                                   @RequestParam(required = false) String action, @RequestParam(required = false) String outcome, @RequestParam(required = false) String resourceType,
                                                   @RequestParam(required = false) String resourceId, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "8") int size) {
        int sz = PageResult.clampSize(size), pg = Math.max(page, 0);
        Query q = auditQuery(from, to, actor, action, outcome, resourceType, resourceId);
        long total = t.count(q, AuditLog.class);
        List<AuditLog> items = t.find(q.with(Sort.by(Sort.Direction.DESC, "createdAt")).skip((long) pg * sz).limit(sz), AuditLog.class);
        return ApiResponse.ok(new PageResult<>(items, total, pg, sz));
    }

    @GetMapping("/audit-logs/actions")
    public ApiResponse<List<String>> actions() { return ApiResponse.ok(t.findDistinct(new Query(), "action", AuditLog.class, String.class).stream().sorted().toList()); }

    @GetMapping("/audit-logs/export")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String from, @RequestParam(required = false) String to, @RequestParam(required = false) String actor,
                                         @RequestParam(required = false) String action, @RequestParam(required = false) String outcome, @RequestParam(required = false) String resourceType,
                                         @RequestParam(required = false) String resourceId) {
        Query q = auditQuery(from, to, actor, action, outcome, resourceType, resourceId).with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(10000);
        StringBuilder sb = new StringBuilder("timestamp,actor,actor_email,action,resource_type,resource_id,outcome,request_id,details\n");
        for (AuditLog a : t.find(q, AuditLog.class))
            sb.append(String.join(",", AnalysisService.cell(String.valueOf(a.createdAt)), AnalysisService.cell(a.actorName), AnalysisService.cell(a.actorEmail), AnalysisService.cell(a.action),
                    AnalysisService.cell(a.resourceType), AnalysisService.cell(a.resourceId), AnalysisService.cell(a.outcome), AnalysisService.cell(a.requestId), AnalysisService.cell(a.details))).append('\n');
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"audit-logs.csv\"").header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=utf-8")
                .body(sb.toString().getBytes(StandardCharsets.UTF_8));
    }

    // ---- jobs & system ----
    @GetMapping("/jobs")
    public ApiResponse<PageResult<AnalysisDto>> jobs(@RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        int sz = PageResult.clampSize(size), pg = Math.max(page, 0);
        Query q = status == null || status.isBlank() ? new Query() : Query.query(Criteria.where("status").is(status.toUpperCase()));
        long total = t.count(q, AnalysisJob.class);
        List<AnalysisDto> items = t.find(q.with(Sort.by(Sort.Direction.DESC, "createdAt")).skip((long) pg * sz).limit(sz), AnalysisJob.class).stream().map(analyses::dto).toList();
        return ApiResponse.ok(new PageResult<>(items, total, pg, sz));
    }

    @GetMapping("/system")
    public ApiResponse<Map<String, Object>> system() {
        Map<String, Object> m = new LinkedHashMap<>();
        try { t.getDb().runCommand(new Document("ping", 1)); m.put("database", Map.of("status", "UP")); } catch (RuntimeException e) { m.put("database", Map.of("status", "DOWN")); }
        try { Map<String, Object> h = ai.health(); Map<String, Object> ms = new LinkedHashMap<>(); ms.put("status", "UP"); ms.put("detectorLoaded", h.get("detectorLoaded")); m.put("aiService", ms);
              try { m.put("models", ai.models()); } catch (RuntimeException ignored) { /* optional */ } }
        catch (RuntimeException e) { m.put("aiService", Map.of("status", "DOWN")); }
        Map<String, Long> queue = new LinkedHashMap<>();
        for (String s : List.of("QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED")) queue.put(s, t.count(Query.query(Criteria.where("status").is(s)), AnalysisJob.class));
        m.put("queue", queue);
        m.put("failedLast24h", t.count(Query.query(new Criteria().andOperator(Criteria.where("status").is("FAILED"), Criteria.where("completedAt").gte(Instant.now().minusSeconds(86400)))), AnalysisJob.class));
        long videosBytes = t.find(Query.query(Criteria.where("deletedAt").is(null)), Video.class).stream().mapToLong(v -> v.sizeBytes).sum();
        Map<String, Object> st = new LinkedHashMap<>(); st.put("videosBytes", videosBytes);
        try { var fs = Files.getFileStore(Path.of(props.videoRoot()).toAbsolutePath()); st.put("diskTotalBytes", fs.getTotalSpace()); st.put("diskUsableBytes", fs.getUsableSpace()); } catch (Exception ignored) { /* path may not exist yet */ }
        m.put("storage", st);
        m.put("version", "1.0.0");
        return ApiResponse.ok(m);
    }
}
