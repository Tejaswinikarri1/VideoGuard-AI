package com.videoguard.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexOperations;

/** Indexes are created explicitly. MongoDB transactions are not required for local review updates. */
@Configuration
public class MongoConfig {
    private final MongoTemplate t;
    public MongoConfig(MongoTemplate t) { this.t = t; }

    @Bean
    MongoTransactionManager transactionManager(MongoDatabaseFactory f) { return new MongoTransactionManager(f); }

    @PostConstruct
    void indexes() {
        t.indexOps("users").ensureIndex(new Index().on("email", Sort.Direction.ASC).unique());
        IndexOperations v = t.indexOps("videos");
        v.ensureIndex(new Index().on("ownerId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));
        v.ensureIndex(new Index().on("metadataStatus", Sort.Direction.ASC));
        t.indexOps("restricted_zones").ensureIndex(new Index().on("videoId", Sort.Direction.ASC));
        IndexOperations a = t.indexOps("analysis_jobs");
        a.ensureIndex(new Index().on("status", Sort.Direction.ASC).on("createdAt", Sort.Direction.ASC));
        a.ensureIndex(new Index().on("videoId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));
        a.ensureIndex(new Index().on("requestedBy", Sort.Direction.ASC).on("idempotencyKey", Sort.Direction.ASC).unique().sparse());
        IndexOperations e = t.indexOps("events");
        e.ensureIndex(new Index().on("analysisId", Sort.Direction.ASC).on("startTimeSeconds", Sort.Direction.ASC));
        e.ensureIndex(new Index().on("analysisId", Sort.Direction.ASC).on("dedupeKey", Sort.Direction.ASC).unique());
        e.ensureIndex(new Index().on("videoId", Sort.Direction.ASC).on("reviewStatus", Sort.Direction.ASC));
        e.ensureIndex(new Index().on("severity", Sort.Direction.ASC));
        t.indexOps("event_reviews").ensureIndex(new Index().on("eventId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));
        IndexOperations l = t.indexOps("audit_logs");
        l.ensureIndex(new Index().on("createdAt", Sort.Direction.DESC));
        l.ensureIndex(new Index().on("actorUserId", Sort.Direction.ASC).on("createdAt", Sort.Direction.DESC));
    }
}
