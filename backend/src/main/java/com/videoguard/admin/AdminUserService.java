package com.videoguard.admin;

import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.common.Ids;
import com.videoguard.common.PageResult;
import com.videoguard.security.AuthUser;
import com.videoguard.users.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class AdminUserService {
    public static final Set<String> ROLES = Set.of("USER", "ANALYST", "ADMIN");
    public record CreateUser(@NotBlank @Size(max = 100) String displayName, @NotBlank @Email String email, @NotBlank @Size(min = 10, max = 128) String password, List<String> roles) {}
    public record UpdateUser(List<String> roles, Boolean active, @Size(max = 500) String notes, @Size(max = 40) String phone) {}

    private final UserRepository users; private final MongoTemplate t; private final PasswordEncoder enc; private final AuditService audit;

    public AdminUserService(UserRepository users, MongoTemplate t, PasswordEncoder enc, AuditService audit) { this.users = users; this.t = t; this.enc = enc; this.audit = audit; }

    public PageResult<UserDto> list(String q, String role, String status, String sort, int page, int size) {
        size = PageResult.clampSize(size); page = Math.max(page, 0);
        List<Criteria> and = new ArrayList<>();
        if (q != null && !q.isBlank()) { String rx = Pattern.quote(q.trim()); and.add(new Criteria().orOperator(Criteria.where("displayName").regex(rx, "i"), Criteria.where("email").regex(rx, "i"))); }
        if (role != null && ROLES.contains(role)) and.add(Criteria.where("roles").is(role));
        if ("ACTIVE".equalsIgnoreCase(status)) and.add(Criteria.where("active").is(true));
        if ("INACTIVE".equalsIgnoreCase(status)) and.add(Criteria.where("active").is(false));
        Query query = and.isEmpty() ? new Query() : Query.query(new Criteria().andOperator(and));
        long total = t.count(query, User.class);
        Sort s = "name".equals(sort) ? Sort.by("displayName") : Sort.by(Sort.Direction.DESC, "createdAt");
        List<UserDto> items = t.find(query.with(s).skip((long) page * size).limit(size), User.class).stream().map(UserDto::of).toList();
        return new PageResult<>(items, total, page, size);
    }

    public UserDto create(AuthUser admin, CreateUser r) {
        String pw = Passwords.check(r.password());
        if (pw != null) throw ApiException.invalid(pw);
        User u = new User();
        u.id = Ids.uuid(); u.displayName = r.displayName().trim(); u.email = r.email().trim().toLowerCase();
        u.passwordHash = enc.encode(r.password());
        u.roles = normalizeRoles(r.roles() == null || r.roles().isEmpty() ? List.of("USER") : r.roles());
        try { users.save(u); } catch (DuplicateKeyException e) { throw new ApiException(HttpStatus.CONFLICT, "VALIDATION_ERROR", "A user with this email already exists."); }
        audit.record(admin, "CREATE_USER", "Create User", "USER", u.id, true, "Created user " + u.email + " with roles " + u.roles);
        return UserDto.of(u);
    }

    public UserDto update(AuthUser admin, String id, UpdateUser r) {
        User u = users.findById(id).orElseThrow(ApiException::notFound);
        List<String> before = new ArrayList<>(u.roles);
        boolean wasActive = u.active;
        if (r.roles() != null) u.roles = normalizeRoles(r.roles());
        if (r.active() != null) u.active = r.active();
        if (r.notes() != null) u.notes = r.notes();
        if (r.phone() != null) u.phone = r.phone();
        boolean losesAdmin = before.contains("ADMIN") && (!u.roles.contains("ADMIN") || !u.active);
        if (losesAdmin && t.count(Query.query(new Criteria().andOperator(Criteria.where("roles").is("ADMIN"), Criteria.where("active").is(true))), User.class) <= 1)
            throw new ApiException(HttpStatus.CONFLICT, "VALIDATION_ERROR", "The last active administrator cannot be demoted or deactivated.");
        u.updatedAt = Instant.now();
        users.save(u);
        if (!before.equals(u.roles)) audit.record(admin, "UPDATE_USER_ROLE", "Update User Role", "USER", id, true, "Updated roles for user " + u.email + " (" + String.join(", ", before) + " → " + String.join(", ", u.roles) + ")");
        if (wasActive != u.active) audit.record(admin, "UPDATE_USER_STATUS", "Update User Status", "USER", id, true, (u.active ? "Activated " : "Deactivated ") + u.email);
        return UserDto.of(u);
    }

    private static List<String> normalizeRoles(List<String> in) {
        LinkedHashSet<String> s = new LinkedHashSet<>();
        s.add("USER"); // every account keeps the base role
        for (String r : in) { if (!ROLES.contains(r)) throw ApiException.invalid("Unknown role: " + r); s.add(r); }
        return new ArrayList<>(s);
    }
}
