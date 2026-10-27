package com.videoguard.videos;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface VideoRepository extends MongoRepository<Video, String> {
    Optional<Video> findByIdAndDeletedAtIsNull(String id);
}
