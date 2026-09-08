package com.smartstock.auth.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password) {
    }

    public record RefreshRequest(
            @NotBlank String refreshToken) {
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
