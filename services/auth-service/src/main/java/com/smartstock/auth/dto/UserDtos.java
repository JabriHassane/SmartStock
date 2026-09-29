package com.smartstock.auth.dto;

import com.smartstock.auth.entity.RoleName;
import com.smartstock.auth.validation.StrongPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class UserDtos {

    private UserDtos() {
    }

    public record CreateUserRequest(
            @NotBlank @Size(min = 3, max = 100) @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "lettres, chiffres, . _ - uniquement") String username,
            @NotBlank @Email @Size(max = 255) String email,
            @StrongPassword String password,
            @Size(max = 100) String firstName,
            @Size(max = 100) String lastName,
            @NotEmpty @Size(max = 3) List<@NotNull RoleName> roles) {
    }

    public record UpdateUserRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @Size(max = 100) String firstName,
            @Size(max = 100) String lastName,
            @NotEmpty @Size(max = 3) List<@NotNull RoleName> roles,
            boolean enabled) {
    }

    public record UpdateProfileRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @Size(max = 100) String firstName,
            @Size(max = 100) String lastName) {
    }

    public record ResetPasswordRequest(
            @StrongPassword String password) {
    }

    public record ChangePasswordRequest(
            @NotBlank @Size(max = 72) String currentPassword,
            @StrongPassword String newPassword) {
    }

    public record UserResponse(
            Long id,
            String username,
            String email,
            String firstName,
            String lastName,
            boolean enabled,
            List<RoleName> roles,
            Instant createdAt) {
    }
}
