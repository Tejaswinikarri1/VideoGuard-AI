package com.videoguard.auth;

import com.videoguard.users.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}
    public record RegisterRequest(@NotBlank @Size(max = 100) String displayName, @NotBlank @Email @Size(max = 200) String email,
                                  @NotBlank @Size(min = 10, max = 128) String password) {}
    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}
    public record ProfileRequest(@NotBlank @Size(max = 100) String displayName, @Size(max = 40) String phone) {}
    public record PasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 10, max = 128) String newPassword) {}
    public record AuthResult(String accessToken, UserDto user) {}
}
