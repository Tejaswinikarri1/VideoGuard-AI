package com.videoguard.users;

import java.time.Instant;
import java.util.List;

public record UserDto(String id, String displayName, String email, List<String> roles, boolean active,
                      String phone, String notes, Instant lastLoginAt, Instant createdAt) {
    public static UserDto of(User u) {
        return new UserDto(u.id, u.displayName, u.email, u.roles, u.active, u.phone, u.notes, u.lastLoginAt, u.createdAt);
    }
}
