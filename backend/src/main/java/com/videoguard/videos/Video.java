package com.videoguard.videos;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("videos")
public class Video {
    @Id public String id;
    public String ownerId;
    public String originalFilename;
    public String storageKey;
    public String thumbnailKey;
    public List<String> frameKeys = new ArrayList<>();
    public String mimeType;
    public String container;
    public String codec;
    public long sizeBytes;
    public Double durationSeconds;
    public Integer width;
    public Integer height;
    public Double frameRate;
    public String metadataStatus = "PROCESSING"; // PROCESSING | COMPLETED | FAILED
    public String metadataError;
    public String description;
    public String location;
    public List<String> sharedWith = new ArrayList<>();
    public Instant createdAt = Instant.now();
    public Instant deletedAt;
}
