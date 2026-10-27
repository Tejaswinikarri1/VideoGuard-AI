package com.videoguard.analysis;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface AnalysisRepository extends MongoRepository<AnalysisJob, String> {
    Optional<AnalysisJob> findByRequestedByAndIdempotencyKey(String requestedBy, String key);
}
