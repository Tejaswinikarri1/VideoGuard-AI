package com.videoguard.security;

import java.util.Set;

public record AuthUser(String id, String email, String displayName, Set<String> roles) {
    public boolean has(String role) { return roles.contains(role); }
}
