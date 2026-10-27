package com.videoguard.zones;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("restricted_zones")
public class Zone {
    @Id public String id;
    public String videoId;
    public String ownerId;
    public String name;
    public String description;
    public String color;
    public List<List<Double>> polygon = new ArrayList<>();
    public boolean enabled = true;
    public Instant createdAt = Instant.now();
    public Instant updatedAt = Instant.now();
}
