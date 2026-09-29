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
import com.smartstock.auth.security.ClientIp;
import com.smartstock.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
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
@Slf4j
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final LoginAttemptService loginAttemptService;

    @Value("${app.jwt.expiration-ms}")
    private long expirationMs;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long refreshExpirationMs;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String username = request.username().trim();
        String ip = ClientIp.current();
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, request.password()));
        } catch (BadCredentialsException e) {
            loginAttemptService.recordFailure(username, ip);
            throw e;
        }
        loginAttemptService.recordSuccess(username, ip);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalStateException("Utilisateur authentifié introuvable"));

        List<String> roles = roleNames(user);
        String accessToken = jwtService.generateAccessToken(user.getUsername(), roles);
        String refreshToken = issueRefreshToken(user);

        return new LoginResponse(accessToken, refreshToken, expirationMs / 1000, roles);
    }

    /**
     * Rotation du refresh token. Présenter un token DÉJÀ révoqué signifie
     * qu'il a été copié (l'utilisateur légitime et l'attaquant l'ont utilisé
     * tour à tour) : toute la famille de sessions de l'utilisateur est alors
     * révoquée, ce qui force une reconnexion des deux côtés.
     */
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public TokenPairResponse refresh(RefreshRequest request) {
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash(request.refreshToken()))
                .orElseThrow(() -> new InvalidRefreshTokenException("Refresh token invalide ou expiré"));
        User user = stored.getUser();

        if (stored.isRevoked()) {
            refreshTokenRepository.revokeAllForUser(user.getId());
            log.warn("SECURITY refresh-token-reuse user={} ip={} — toutes les sessions révoquées",
                    user.getUsername(), ClientIp.current());
            throw new InvalidRefreshTokenException("Refresh token invalide ou expiré");
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new InvalidRefreshTokenException("Refresh token invalide ou expiré");
        }
        if (!user.isEnabled() || user.isLocked()) {
            refreshTokenRepository.revokeAllForUser(user.getId());
            throw new InvalidRefreshTokenException("Compte désactivé ou verrouillé");
        }

        stored.setRevoked(true);
        refreshTokenRepository.save(stored);

        // Rôles relus en base : un changement de rôle s'applique au prochain renouvellement.
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
                    log.info("SECURITY logout user={}", t.getUser().getUsername());
                });
    }

    /** Purge quotidienne des refresh tokens expirés (les révoqués non expirés restent pour détecter une réutilisation). */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void purgeExpiredRefreshTokens() {
        int deleted = refreshTokenRepository.deleteExpired(Instant.now());
        if (deleted > 0) {
            log.info("Purge : {} refresh token(s) expiré(s) supprimé(s)", deleted);
        }
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
