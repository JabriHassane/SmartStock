package com.smartstock.auth.security;

import com.smartstock.auth.entity.User;
import com.smartstock.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * accountNonLocked reflète le verrouillage temporaire : Spring Security
     * vérifie le verrou AVANT le mot de passe, donc un compte verrouillé ne
     * révèle plus si le mot de passe tenté est correct.
     */
    @Override
    public org.springframework.security.core.userdetails.User loadUserByUsername(String username)
            throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Utilisateur introuvable: " + username));

        var authorities = user.getRoles().stream()
                .map(role -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + role.getName()))
                .toList();

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(), user.getPasswordHash(), user.isEnabled(), true, true, !user.isLocked(), authorities);
    }
}
