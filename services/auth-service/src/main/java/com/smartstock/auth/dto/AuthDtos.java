package com.smartstock.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank @Size(max = 100) String username,
            @NotBlank @Size(max = 72) String password) {
    }

    public record RefreshRequest(
            @NotBlank @Size(max = 100) String refreshToken) {
    }

    public record TokenPairResponse(
            String accessToken,
            String refreshToken,
            long expiresInSeconds) {
    }

    public record LoginResponse(
            String accessToken,
            String refreshToken,
            long expiresInSeconds,
            List<String> roles) {
    }
}
