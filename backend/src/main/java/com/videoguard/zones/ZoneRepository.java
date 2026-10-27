package com.videoguard.zones;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ZoneRepository extends MongoRepository<Zone, String> {
    List<Zone> findByVideoIdOrderByCreatedAtAsc(String videoId);
}
