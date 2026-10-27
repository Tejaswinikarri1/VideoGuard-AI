package com.videoguard.events;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document("event_reviews")
public class Review {
    @Id public String id;
    public String eventId;
    public String reviewerId;
    public String reviewerName;
    public String decision; // CONFIRMED | REJECTED | UNCERTAIN
    public String notes;
    public Instant createdAt = Instant.now();
}
