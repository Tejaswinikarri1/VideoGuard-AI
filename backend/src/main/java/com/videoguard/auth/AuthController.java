package com.videoguard.auth;

import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.common.ApiResponse;
import com.videoguard.security.AuthUser;
import com.videoguard.security.CurrentUser;
import com.videoguard.users.UserDto;
import com.videoguard.users.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService auth;
    private final UserRepository users;
    private final AuditService audit;

    public AuthController(AuthService auth, UserRepository users, AuditService audit) { this.auth = auth; this.users = users; this.audit = audit; }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthDtos.AuthResult> register(@Valid @RequestBody AuthDtos.RegisterRequest r) { return ApiResponse.ok(auth.register(r)); }

    @PostMapping("/login")
    public ApiResponse<AuthDtos.AuthResult> login(@Valid @RequestBody AuthDtos.LoginRequest r) { return ApiResponse.ok(auth.login(r)); }

    @GetMapping("/me")
    public ApiResponse<UserDto> me() {
        AuthUser u = CurrentUser.require();
        return ApiResponse.ok(users.findById(u.id()).map(UserDto::of).orElseThrow(ApiException::notFound));
    }

    @PatchMapping("/me")
    public ApiResponse<UserDto> updateProfile(@Valid @RequestBody AuthDtos.ProfileRequest r) {
        return ApiResponse.ok(auth.updateProfile(CurrentUser.require().id(), r));
    }

    @PostMapping("/password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody AuthDtos.PasswordRequest r) {
        auth.changePassword(CurrentUser.require().id(), r);
        return new ApiResponse<>(null, null, org.slf4j.MDC.get("requestId"));
    }

    /** Access tokens are short-lived and stateless; logout is recorded for audit and the client discards the token. */
    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        audit.record(CurrentUser.require(), "LOGOUT", "Logout", "AUTH", null, true, null);
        return new ApiResponse<>(null, null, org.slf4j.MDC.get("requestId"));
    }
}
