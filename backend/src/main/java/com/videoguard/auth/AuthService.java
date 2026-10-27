package com.videoguard.auth;

import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.common.Ids;
import com.videoguard.security.JwtService;
import com.videoguard.users.Passwords;
import com.videoguard.users.User;
import com.videoguard.users.UserDto;
import com.videoguard.users.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class AuthService {
    // Real BCrypt hash of a random value, compared when the email is unknown so response timing does not reveal existence.
    private final String dummyHash;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final AuditService audit;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt, AuditService audit) {
        this.users = users; this.encoder = encoder; this.jwt = jwt; this.audit = audit;
        this.dummyHash = encoder.encode(Ids.uuid());
    }

    public static String normalize(String email) { return email.trim().toLowerCase(); }

    public AuthDtos.AuthResult register(AuthDtos.RegisterRequest r) {
        String pw = Passwords.check(r.password());
        if (pw != null) throw ApiException.invalid(pw);
        User u = new User();
        u.id = Ids.uuid();
        u.displayName = r.displayName().trim();
        u.email = normalize(r.email());
        u.passwordHash = encoder.encode(r.password());
        u.roles = List.of("USER"); // public registration can never grant ANALYST or ADMIN
        try {
            users.save(u);
        } catch (DuplicateKeyException e) {
            audit.recordFor(null, u.email, null, "REGISTER", "Register", "USER", null, false, "duplicate email");
            throw new ApiException(HttpStatus.CONFLICT, "VALIDATION_ERROR", "Unable to create an account with these details.");
        }
        audit.recordFor(u.id, u.email, u.displayName, "REGISTER", "Register", "USER", u.id, true, null);
        return new AuthDtos.AuthResult(jwt.issueAccess(u.id, u.roles), UserDto.of(u));
    }

    public UserDto updateProfile(String userId, AuthDtos.ProfileRequest r) {
        User u = users.findById(userId).orElseThrow(ApiException::notFound);
        u.displayName = r.displayName().trim();
        u.phone = r.phone() == null || r.phone().isBlank() ? null : r.phone().trim();
        u.updatedAt = Instant.now();
        users.save(u);
        audit.recordFor(u.id, u.email, u.displayName, "UPDATE_PROFILE", "Update Profile", "USER", u.id, true, "Profile updated");
        return UserDto.of(u);
    }

    /** Requires the current password; the new one must satisfy the same policy as registration. */
    public void changePassword(String userId, AuthDtos.PasswordRequest r) {
        User u = users.findById(userId).orElseThrow(ApiException::notFound);
        if (!encoder.matches(r.currentPassword(), u.passwordHash)) {
            audit.recordFor(u.id, u.email, u.displayName, "CHANGE_PASSWORD", "Change Password", "USER", u.id, false, "current password incorrect");
            throw new ApiException(HttpStatus.BAD_REQUEST, "AUTH_INVALID_CREDENTIALS", "The current password is incorrect.");
        }
        String bad = Passwords.check(r.newPassword());
        if (bad != null) throw ApiException.invalid(bad);
        if (encoder.matches(r.newPassword(), u.passwordHash)) throw ApiException.invalid("The new password must be different from the current one.");
        u.passwordHash = encoder.encode(r.newPassword());
        u.updatedAt = Instant.now();
        users.save(u);
        audit.recordFor(u.id, u.email, u.displayName, "CHANGE_PASSWORD", "Change Password", "USER", u.id, true, null);
    }

    public AuthDtos.AuthResult login(AuthDtos.LoginRequest r) {
        String email = normalize(r.email());
        User u = users.findByEmail(email).orElse(null);
        boolean ok = encoder.matches(r.password(), u == null ? dummyHash : u.passwordHash) && u != null && u.active;
        if (!ok) {
            audit.recordFor(u == null ? null : u.id, email, null, "LOGIN_FAILED", "Login Failed", "AUTH", null, false, "invalid credentials");
            throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_CREDENTIALS", "Invalid email or password.");
        }
        u.lastLoginAt = Instant.now();
        users.save(u);
        audit.recordFor(u.id, u.email, u.displayName, "LOGIN", "Login", "AUTH", null, true, null);
        return new AuthDtos.AuthResult(jwt.issueAccess(u.id, u.roles), UserDto.of(u));
    }
}
