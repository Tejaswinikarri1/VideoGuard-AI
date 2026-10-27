package com.videoguard.audit;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("audit_logs")
public class AuditLog {
    @Id public String id;
    public String actorUserId;
    public String actorEmail;
    public String actorName;
    public String action;
    public String actionLabel;
    public String resourceType;
    public String resourceId;
    public String outcome; // SUCCESS | FAILURE
    public String requestId;
    public String details;
    public String ip;
    public Instant createdAt = Instant.now();
}
