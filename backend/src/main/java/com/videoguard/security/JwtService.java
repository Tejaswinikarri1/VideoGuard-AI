package com.videoguard.security;

import com.videoguard.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Service
public class JwtService {
    public static class TokenExpired extends RuntimeException {}

    private final SecretKey key;
    private final AppProperties props;

    public JwtService(AppProperties props) {
        byte[] secret = props.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        this.key = Keys.hmacShaKeyFor(secret);
        this.props = props;
    }

    public String issueAccess(String userId, List<String> roles) {
        Instant now = Instant.now();
        return Jwts.builder().subject(userId).claim("scope", "access").claim("roles", roles)
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(props.jwtTtlMinutes() * 60L))).signWith(key).compact();
    }

    /** Short-lived token that only grants read access to one media resource (e.g. "video:abc"). */
    public String issueMedia(String userId, String resource) {
        Instant now = Instant.now();
        return Jwts.builder().subject(userId).claim("scope", "media").claim("res", resource)
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(props.mediaTokenTtlSeconds()))).signWith(key).compact();
    }

    public Claims parse(String token) {
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        } catch (ExpiredJwtException e) {
            throw new TokenExpired();
        }
    }
}
