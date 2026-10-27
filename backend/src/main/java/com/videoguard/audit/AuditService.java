package com.videoguard.audit;

import com.videoguard.common.Ids;
import com.videoguard.security.AuthUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

/** Never pass passwords, tokens or video bytes in `details`. */
@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private final AuditRepository repo;

    public AuditService(AuditRepository repo) { this.repo = repo; }

    public void record(AuthUser actor, String action, String label, String resourceType, String resourceId, boolean success, String details) {
        recordFor(actor == null ? null : actor.id(), actor == null ? null : actor.email(), actor == null ? null : actor.displayName(),
                action, label, resourceType, resourceId, success, details);
    }

    public void recordFor(String actorId, String email, String name, String action, String label, String resourceType, String resourceId, boolean success, String details) {
        try {
            AuditLog a = new AuditLog();
            a.id = Ids.uuid();
            a.actorUserId = actorId; a.actorEmail = email; a.actorName = name;
            a.action = action; a.actionLabel = label; a.resourceType = resourceType; a.resourceId = resourceId;
            a.outcome = success ? "SUCCESS" : "FAILURE";
            a.requestId = MDC.get("requestId"); a.ip = MDC.get("clientIp"); a.details = details;
            repo.save(a);
        } catch (Exception e) {
            log.error("audit write failed action={} resource={}", action, resourceId, e); // audit failure must not break the request
        }
    }

    public void system(String action, String label, String resourceType, String resourceId, boolean success, String details) {
        recordFor("system", "ai-service", "System (AI Service)", action, label, resourceType, resourceId, success, details);
    }
}
