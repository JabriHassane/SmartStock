package com.smartstock.auth.service;

import com.smartstock.auth.dto.AuthDtos.LoginRequest;
import com.smartstock.auth.dto.AuthDtos.LoginResponse;
import com.smartstock.auth.dto.AuthDtos.RefreshRequest;
import com.smartstock.auth.dto.AuthDtos.TokenPairResponse;
import com.smartstock.auth.entity.RefreshToken;
import com.smartstock.auth.entity.Role;
import com.smartstock.auth.entity.User;
import com.smartstock.auth.exception.InvalidRefreshTokenException;
import com.smartstock.auth.repository.RefreshTokenRepository;
import com.smartstock.auth.repository.UserRepository;
import com.smartstock.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long refreshExpirationMs;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Transactional
    public LoginResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new IllegalStateException("Utilisateur authentifié introuvable"));

        List<String> roles = roleNames(user);
        String accessToken = jwtService.generateAccessToken(user.getUsername(), roles);
        String refreshToken = issueRefreshToken(user);

        return new LoginResponse(accessToken, refreshToken, expirationMs / 1000, roles);
    }

    @Transactional
    public TokenPairResponse refresh(RefreshRequest request) {
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash(request.refreshToken()))
                .filter(t -> !t.isRevoked() && t.getExpiresAt().isAfter(Instant.now()))
                .orElseThrow(() -> new InvalidRefreshTokenException("Refresh token invalide ou expiré"));

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        User user = stored.getUser();
        List<String> roles = roleNames(user);
        String accessToken = jwtService.generateAccessToken(user.getUsername(), roles);
        String newRefreshToken = issueRefreshToken(user);

        return new TokenPairResponse(accessToken, newRefreshToken, expirationMs / 1000);
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByTokenHash(hash(refreshToken))
                .ifPresent(t -> {
                    t.setRevoked(true);
                    refreshTokenRepository.save(t);
                });
    }

    private String issueRefreshToken(User user) {
        byte[] randomBytes = new byte[32];
        SECURE_RANDOM.nextBytes(randomBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(hash(rawToken));
        refreshToken.setExpiresAt(Instant.now().plusMillis(refreshExpirationMs));
        refreshTokenRepository.save(refreshToken);

        return rawToken;
    }

    private static List<String> roleNames(User user) {
        return user.getRoles().stream().map(Role::getName).map(Enum::name).toList();
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
