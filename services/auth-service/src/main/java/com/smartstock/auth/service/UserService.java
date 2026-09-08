package com.smartstock.auth.service;

import com.smartstock.auth.dto.UserDtos.CreateUserRequest;
import com.smartstock.auth.dto.UserDtos.UserResponse;
import com.smartstock.auth.entity.Role;
import com.smartstock.auth.entity.RoleName;
import com.smartstock.auth.entity.User;
import com.smartstock.auth.exception.DuplicateResourceException;
import com.smartstock.auth.exception.ResourceNotFoundException;
import com.smartstock.auth.repository.RoleRepository;
import com.smartstock.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new DuplicateResourceException("Ce nom d'utilisateur existe déjà");
        }
        if (userRepository.existsByEmail(request.email())) {
            throw new DuplicateResourceException("Cet email existe déjà");
        }

        Set<Role> roles = request.roles().stream()
                .map(this::findRole)
                .collect(Collectors.toSet());

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName());
        user.setLastName(request.lastName());
        user.setRoles(roles);

        return toResponse(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream().map(UserService::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public UserResponse getByUsername(String username) {
        return userRepository.findByUsername(username)
                .map(UserService::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur introuvable: " + username));
    }

    private Role findRole(RoleName name) {
        return roleRepository.findByName(name)
                .orElseThrow(() -> new IllegalStateException("Rôle inconnu: " + name));
    }

    private static UserResponse toResponse(User user) {
        List<RoleName> roles = user.getRoles().stream().map(Role::getName).toList();
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
