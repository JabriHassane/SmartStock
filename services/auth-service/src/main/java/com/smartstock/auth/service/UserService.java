package com.smartstock.auth.service;

import com.smartstock.auth.dto.UserDtos.ChangePasswordRequest;
import com.smartstock.auth.dto.UserDtos.CreateUserRequest;
import com.smartstock.auth.dto.UserDtos.UpdateProfileRequest;
import com.smartstock.auth.dto.UserDtos.UpdateUserRequest;
import com.smartstock.auth.dto.UserDtos.UserResponse;
import com.smartstock.auth.entity.Role;
import com.smartstock.auth.entity.RoleName;
import com.smartstock.auth.entity.User;
import com.smartstock.auth.exception.BusinessRuleException;
import com.smartstock.auth.exception.DuplicateResourceException;
import com.smartstock.auth.exception.ResourceNotFoundException;
import com.smartstock.auth.repository.RefreshTokenRepository;
import com.smartstock.auth.repository.RoleRepository;
import com.smartstock.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserResponse createUser(CreateUserRequest request, String actor) {
        if (userRepository.existsByUsername(request.username())) {
            throw new DuplicateResourceException("Ce nom d'utilisateur existe déjà");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new DuplicateResourceException("Cet email existe déjà");
        }

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setRoles(findRoles(request.roles()));

        User saved = userRepository.save(user);
        log.info("SECURITY user-created user={} roles={} by={}", saved.getUsername(), request.roles(), actor);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listUsers() {
        return userRepository.findAll(Sort.by("createdAt")).stream().map(UserService::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public UserResponse getByUsername(String username) {
        return toResponse(findByUsername(username));
    }

    /**
     * Mise à jour par un SuperAdmin. Un SuperAdmin ne peut ni se désactiver
     * ni se retirer son propre rôle, et le dernier SuperAdmin actif ne peut
     * pas perdre ce rôle — sinon plus personne ne pourrait gérer les comptes.
     */
    @Transactional
    public UserResponse updateUser(Long id, UpdateUserRequest request, String currentUsername) {
        User user = findById(id);
        if (userRepository.existsByEmailAndIdNot(request.email(), id)) {
            throw new DuplicateResourceException("Cet email existe déjà");
        }

        boolean wasSuperAdmin = hasRole(user, RoleName.SUPERADMIN) && user.isEnabled();
        boolean staysSuperAdmin = request.roles().contains(RoleName.SUPERADMIN) && request.enabled();

        if (user.getUsername().equals(currentUsername) && !staysSuperAdmin) {
            throw new BusinessRuleException("Vous ne pouvez pas retirer votre propre accès SuperAdmin");
        }
        if (wasSuperAdmin && !staysSuperAdmin && userRepository.countEnabledWithRole(RoleName.SUPERADMIN) <= 1) {
            throw new BusinessRuleException("Il doit rester au moins un SuperAdmin actif");
        }

        user.setEmail(request.email());
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        boolean rolesChanged = !user.getRoles().stream().map(r -> r.getName()).collect(Collectors.toSet())
                .equals(Set.copyOf(request.roles()));
        user.setRoles(findRoles(request.roles()));
        user.setEnabled(request.enabled());

        // Désactivation ou changement de rôle : on coupe les sessions existantes
        // (l'access token en cours expire de lui-même sous 15 min).
        if (!request.enabled() || rolesChanged) {
            refreshTokenRepository.revokeAllForUser(user.getId());
        }
        log.info("SECURITY user-updated user={} roles={} enabled={} by={}", user.getUsername(), request.roles(), request.enabled(), currentUsername);
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void resetPassword(Long id, String newPassword, String actor) {
        User user = findById(id);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        // Réinitialisation par un admin = déverrouillage explicite.
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId());
        log.info("SECURITY password-reset user={} by={}", user.getUsername(), actor);
    }

    @Transactional
    public void deleteUser(Long id, String currentUsername) {
        User user = findById(id);
        if (user.getUsername().equals(currentUsername)) {
            throw new BusinessRuleException("Vous ne pouvez pas supprimer votre propre compte");
        }
        if (hasRole(user, RoleName.SUPERADMIN) && user.isEnabled()
                && userRepository.countEnabledWithRole(RoleName.SUPERADMIN) <= 1) {
            throw new BusinessRuleException("Il doit rester au moins un SuperAdmin actif");
        }
        userRepository.delete(user);
        log.info("SECURITY user-deleted user={} by={}", user.getUsername(), currentUsername);
    }

    @Transactional
    public UserResponse updateProfile(String username, UpdateProfileRequest request) {
        User user = findByUsername(username);
        if (userRepository.existsByEmailAndIdNot(request.email(), user.getId())) {
            throw new DuplicateResourceException("Cet email existe déjà");
        }
        user.setEmail(request.email());
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void changePassword(String username, ChangePasswordRequest request) {
        User user = findByUsername(username);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            log.warn("SECURITY password-change-failed user={}", username);
            throw new BusinessRuleException("Mot de passe actuel incorrect");
        }
        if (request.newPassword().equals(request.currentPassword())) {
            throw new BusinessRuleException("Le nouveau mot de passe doit être différent de l'actuel");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        refreshTokenRepository.revokeAllForUser(user.getId());
        log.info("SECURITY password-changed user={}", username);
    }

    private User findById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable: " + id));
    }

    private User findByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable: " + username));
    }

    private Set<Role> findRoles(List<RoleName> names) {
        return names.stream()
                .map(name -> roleRepository.findByName(name)
                        .orElseThrow(() -> new IllegalStateException("Rôle inconnu: " + name)))
                .collect(Collectors.toCollection(HashSet::new));
    }

    private static boolean hasRole(User user, RoleName name) {
        return user.getRoles().stream().anyMatch(r -> r.getName() == name);
    }

    private static UserResponse toResponse(User user) {
        List<RoleName> roles = user.getRoles().stream().map(Role::getName).sorted().toList();
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.isEnabled(),
                roles,
                user.getCreatedAt());
    }
}
