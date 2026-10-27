package com.videoguard.users;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document("users")
public class User {
    @Id public String id;
    public String displayName;
    public String email;
    public String passwordHash;
    public List<String> roles = new ArrayList<>(List.of("USER"));
    public boolean active = true;
    public String phone;
    public String notes;
    public Instant lastLoginAt;
    public Instant createdAt = Instant.now();
    public Instant updatedAt = Instant.now();
}
