package com.smartstock.auth.config;

import com.smartstock.auth.entity.Role;
import com.smartstock.auth.entity.RoleName;
import com.smartstock.auth.entity.User;
import com.smartstock.auth.repository.RoleRepository;
import com.smartstock.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Les 3 rôles fixes sont déjà insérés par V1__init_schema.sql. Ce seeder ne
 * gère que le compte SuperAdmin de bootstrap, nécessaire puisque
 * POST /api/users est lui-même réservé au rôle SUPERADMIN.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.username}")
    private String adminUsername;

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) {
            return;
        }

        Role superAdminRole = roleRepository.findByName(RoleName.SUPERADMIN)
                .orElseThrow(() -> new IllegalStateException("Rôle SUPERADMIN introuvable — migration V1 non appliquée ?"));

        User admin = new User();
        admin.setUsername(adminUsername);
        admin.setEmail(adminEmail);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setRoles(Set.of(superAdminRole));
        userRepository.save(admin);

        log.info("Compte SuperAdmin initial créé : {}", adminUsername);
    }
}
