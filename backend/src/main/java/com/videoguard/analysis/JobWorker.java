package com.videoguard.analysis;

import com.videoguard.audit.AuditService;
import com.videoguard.config.AppProperties;
import com.videoguard.events.Event;
import com.videoguard.storage.StorageService;
import com.videoguard.videos.Video;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import java.nio.file.Files;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

/**
 * Durable queue on MongoDB (no Redis/Docker needed):
 *  - claim = atomic findAndModify QUEUED -> RUNNING, so two workers can never take the same job;
 *  - a lease is extended while the AI job is polled; expired leases are recovered (re-queued up to maxJobAttempts, else FAILED);
 *  - event persistence is idempotent through a unique (analysisId, dedupeKey) index.
 */
@Component
public class JobWorker {
    private static final Logger log = LoggerFactory.getLogger(JobWorker.class);
    private final MongoTemplate t; private final AiClient ai; private final AppProperties props; private final AuditService audit; private final StorageService storage;
    private final ExecutorService pool; private final Semaphore slots;

    public JobWorker(MongoTemplate t, AiClient ai, AppProperties props, AuditService audit, StorageService storage) {
        this.t = t; this.ai = ai; this.props = props; this.audit = audit; this.storage = storage;
        int n = Math.max(1, props.workerThreads());
        this.pool = Executors.newFixedThreadPool(n); this.slots = new Semaphore(n);
    }

    @PreDestroy void stop() { pool.shutdownNow(); }

    @Scheduled(fixedDelay = 2000)
    public void poll() {
        try { recoverStale(); } catch (RuntimeException e) { log.error("stale recovery failed", e); }
        while (slots.tryAcquire()) {
            AnalysisJob j;
            try { j = claim(); } catch (RuntimeException e) { slots.release(); log.error("claim failed", e); return; }
            if (j == null) { slots.release(); return; }
            pool.submit(() -> {
                try { run(j); }
                catch (Throwable e) { log.error("job {} crashed", j.id, e); finish(j.id, "FAILED", "ANALYSIS_WORKER_FAILED", "The analysis worker failed unexpectedly."); }
                finally { slots.release(); }
            });
        }
    }

    AnalysisJob claim() {
        Query q = Query.query(Criteria.where("status").is("QUEUED")).with(Sort.by("createdAt")).limit(1);
        Update u = new Update().set("status", "RUNNING").set("startedAt", Instant.now()).set("stage", "JOB_ACCEPTED")
                .set("leaseUntil", Instant.now().plusSeconds(props.jobLeaseSeconds())).inc("attempt", 1);
        return t.findAndModify(q, u, FindAndModifyOptions.options().returnNew(true), AnalysisJob.class);
    }

    void recoverStale() {
        Query q = Query.query(new Criteria().andOperator(Criteria.where("status").is("RUNNING"), Criteria.where("leaseUntil").lt(Instant.now())));
        for (AnalysisJob j : t.find(q, AnalysisJob.class)) {
            Criteria same = new Criteria().andOperator(Criteria.where("_id").is(j.id), Criteria.where("status").is("RUNNING"), Criteria.where("leaseUntil").lt(Instant.now()));
            if (j.attempt < props.maxJobAttempts()) {
                // A restart is a fresh run of the same record: progress legitimately resets here.
                t.updateFirst(Query.query(same), new Update().set("status", "QUEUED").set("progressPercent", 0).set("stageProgressPercent", 0)
                        .set("stage", "JOB_ACCEPTED").set("stageTimings", new ArrayList<>()).push("logs", "Worker lease expired; job re-queued (attempt " + j.attempt + ").").unset("leaseUntil"), AnalysisJob.class);
            } else {
                t.updateFirst(Query.query(same), new Update().set("status", "FAILED").set("errorCode", "ANALYSIS_WORKER_FAILED")
                        .set("errorMessage", "The worker stopped responding and the retry limit was reached.").set("completedAt", Instant.now()), AnalysisJob.class);
            }
        }
    }

    @SuppressWarnings("unchecked")
    void run(AnalysisJob job) throws InterruptedException {
        Video v = t.findById(job.videoId, Video.class);
        if (v == null || v.deletedAt != null) { finish(job.id, "FAILED", "RESOURCE_NOT_FOUND", "The video no longer exists."); return; }
        try { ai.submit(job.id, v.storageKey, job.zones); }
        catch (RuntimeException e) {
            String message = aiSubmissionFailure(e);
            log.error("AI service submission failed for job {}: {}", job.id, message, e);
            finish(job.id, "FAILED", "AI_SERVICE_UNAVAILABLE", message);
            return;
        }

        int misses = 0;
        while (!Thread.currentThread().isInterrupted()) {
            Thread.sleep(1500);
            AnalysisJob cur = t.findById(job.id, AnalysisJob.class);
            if (cur == null || !"RUNNING".equals(cur.status)) return;
            if (cur.cancelRequested) {
                try { ai.cancel(job.id); } catch (RuntimeException ignored) { /* AI job may already be gone */ }
                finish(job.id, "CANCELLED", null, null);
                return;
            }
            Map<String, Object> st;
            try { st = ai.status(job.id); misses = 0; }
            catch (RuntimeException e) {
                if (++misses >= 5) { finish(job.id, "FAILED", "AI_SERVICE_UNAVAILABLE", "The AI service stopped responding."); return; }
                continue;
            }
            String stage = String.valueOf(st.get("stage"));
            Double pct = AiResultValidator.num(st.get("progressPercent")), sp = AiResultValidator.num(st.get("stageProgressPercent"));
            Update u = new Update().set("leaseUntil", Instant.now().plusSeconds(props.jobLeaseSeconds()));
            if (AiResultValidator.STAGES.contains(stage)) u.set("stage", stage);
            if (pct != null) u.max("progressPercent", (int) Math.max(0, Math.min(99, Math.round(pct)))); // 100 only on completion
            if (sp != null) u.set("stageProgressPercent", (int) Math.max(0, Math.min(100, Math.round(sp))));
            if (st.get("stages") instanceof List<?> l && l.size() <= 20) u.set("stageTimings", l);
            if (st.get("logs") instanceof List<?> l) u.set("logs", l.stream().skip(Math.max(0, l.size() - 500)).map(String::valueOf).toList());
            t.updateFirst(Query.query(new Criteria().andOperator(Criteria.where("_id").is(job.id), Criteria.where("status").is("RUNNING"))), u, AnalysisJob.class);

            String status = String.valueOf(st.get("status"));
            switch (status) {
                case "COMPLETED" -> { persist(job, v); return; }
                case "FAILED" -> { finish(job.id, "FAILED", sanitizeCode(st.get("errorCode")), sanitizeMsg(st.get("errorMessage"))); return; }
                case "CANCELLED" -> { finish(job.id, "CANCELLED", null, null); return; }
                default -> { /* still running */ }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void persist(AnalysisJob job, Video v) {
        t.updateFirst(Query.query(Criteria.where("_id").is(job.id)), new Update().set("stage", "PERSISTING_RESULTS"), AnalysisJob.class);
        Map<String, Object> res;
        try { res = ai.result(job.id); }
        catch (RuntimeException e) { finish(job.id, "FAILED", "AI_SERVICE_UNAVAILABLE", "Results could not be retrieved from the AI service."); return; }
        String ruleVersion = String.valueOf(res.getOrDefault("ruleVersion", "unknown"));
        int accepted = 0, rejected = 0;
        if (res.get("events") instanceof List<?> list) {
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> m)) { rejected++; continue; }
                Optional<Event> ev = AiResultValidator.event(job.id, job.videoId, v.durationSeconds == null ? 0 : v.durationSeconds, ruleVersion, (Map<String, Object>) m);
                if (ev.isEmpty()) { rejected++; continue; }
                Event e = ev.get();
                if (e.evidenceStorageKey != null && !Files.isRegularFile(storage.evidence(e.evidenceStorageKey))) { e.evidenceStorageKey = null; e.evidenceStatus = "FAILED"; }
                try { t.insert(e); accepted++; } catch (DuplicateKeyException dup) { accepted++; /* repeated delivery: already stored */ }
            }
        }
        long total = t.count(Query.query(Criteria.where("analysisId").is(job.id)), Event.class);
        long pending = t.count(Query.query(new Criteria().andOperator(Criteria.where("analysisId").is(job.id), Criteria.where("reviewStatus").is("PENDING"))), Event.class);
        AnalysisJob done = t.findAndModify(Query.query(new Criteria().andOperator(Criteria.where("_id").is(job.id), Criteria.where("status").is("RUNNING"))),
                new Update().set("status", "COMPLETED").set("stage", "COMPLETED").set("progressPercent", 100).set("stageProgressPercent", 100)
                        .set("completedAt", Instant.now()).set("eventCount", (int) total).set("modelVersion", String.valueOf(res.get("modelVersion")))
                        .set("pipelineVersion", String.valueOf(res.get("pipelineVersion"))).unset("leaseUntil"),
                FindAndModifyOptions.options().returnNew(true), AnalysisJob.class);
        if (done != null) {
            audit.system("ANALYSIS_COMPLETED", "Analysis Completed", "ANALYSIS", job.id, true,
                    "Analysis completed with " + total + " events generated (" + pending + " pending review)" + (rejected > 0 ? "; " + rejected + " invalid AI events discarded" : ""));
        }
    }

    private void finish(String id, String status, String code, String message) {
        Update u = new Update().set("status", status).set("completedAt", Instant.now()).unset("leaseUntil");
        if (code != null) u.set("errorCode", code).set("errorMessage", message);
        if ("FAILED".equals(status) && message != null) u.push("logs", Instant.now() + " ERROR " + message);
        t.updateFirst(Query.query(new Criteria().andOperator(Criteria.where("_id").is(id), Criteria.where("status").in("RUNNING", "QUEUED"))), u, AnalysisJob.class);
        if ("FAILED".equals(status)) audit.system("ANALYSIS_FAILED", "Analysis Failed", "ANALYSIS", id, false, code);
    }

    private static String aiSubmissionFailure(RuntimeException e) {
        if (e instanceof RestClientResponseException response) {
            String detail = response.getResponseBodyAsString().replaceAll("\\s+", " ").trim();
            if (detail.length() > 300) detail = detail.substring(0, 300) + "...";
            return "The AI service rejected the job (HTTP " + response.getStatusCode().value() + ")"
                    + (detail.isEmpty() ? "." : ": " + detail);
        }
        if (e instanceof ResourceAccessException) {
            return "The backend could not connect to the AI service. Check AI_SERVICE_URL and confirm the service is running.";
        }
        return "The backend could not submit the job to the AI service (" + e.getClass().getSimpleName() + "). Check backend logs.";
    }

    private static String sanitizeCode(Object o) { String s = o == null ? "" : String.valueOf(o); return s.matches("[A-Z_]{3,40}") ? s : "ANALYSIS_WORKER_FAILED"; }
    private static String sanitizeMsg(Object o) { String s = o == null ? "Analysis failed." : String.valueOf(o); return s.substring(0, Math.min(200, s.length())); }
}
