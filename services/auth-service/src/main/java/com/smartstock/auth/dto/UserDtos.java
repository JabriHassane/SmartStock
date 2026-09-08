package com.smartstock.auth.dto;

import com.smartstock.auth.entity.RoleName;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class UserDtos {

    private UserDtos() {
    }

    public record CreateUserRequest(
            @NotBlank @Size(min = 3, max = 100) String username,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8) String password,
            String firstName,
            String lastName,
            @NotEmpty List<RoleName> roles) {
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
