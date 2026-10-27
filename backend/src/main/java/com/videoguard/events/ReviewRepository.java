package com.videoguard.events;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ReviewRepository extends MongoRepository<Review, String> {
    List<Review> findByEventIdOrderByCreatedAtDesc(String eventId);
}
