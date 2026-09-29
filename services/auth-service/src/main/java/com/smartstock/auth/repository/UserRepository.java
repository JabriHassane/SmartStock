package com.smartstock.auth.repository;

import com.smartstock.auth.entity.RoleName;
import com.smartstock.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, Long id);

    @Query("SELECT count(u) FROM User u JOIN u.roles r WHERE r.name = :role AND u.enabled = true")
    long countEnabledWithRole(@Param("role") RoleName role);
}
