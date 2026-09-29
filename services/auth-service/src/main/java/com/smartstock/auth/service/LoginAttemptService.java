package com.smartstock.auth.service;

import com.smartstock.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Verrouillage temporaire d'un compte après trop d'échecs de connexion, en
 * complément de la limite de débit par IP de nginx (qui ne protège pas
 * contre une attaque distribuée sur un même compte).
 *
 * REQUIRES_NEW : le compteur doit être enregistré même si la transaction
 * de connexion échoue (l'exception d'authentification l'annulerait sinon).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoginAttemptService {

    private final UserRepository userRepository;

    @Value("${app.security.max-failed-logins:5}")
    private int maxFailedLogins;

    @Value("${app.security.lockout-duration:PT15M}")
    private Duration lockoutDuration;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String username, String ip) {
        userRepository.findByUsername(username).ifPresentOrElse(user -> {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= maxFailedLogins) {
                user.setLockedUntil(Instant.now().plus(lockoutDuration));
                user.setFailedLoginAttempts(0);
                log.warn("SECURITY account-locked user={} ip={} duration={}", username, ip, lockoutDuration);
            } else {
                log.warn("SECURITY login-failed user={} ip={} attempt={}/{}", username, ip, attempts, maxFailedLogins);
            }
            userRepository.save(user);
        }, () -> log.warn("SECURITY login-failed unknown-user={} ip={}", username, ip));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSuccess(String username, String ip) {
        userRepository.findByUsername(username).ifPresent(user -> {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
            user.setLastLoginAt(Instant.now());
            userRepository.save(user);
        });
        log.info("SECURITY login-success user={} ip={}", username, ip);
    }
}
