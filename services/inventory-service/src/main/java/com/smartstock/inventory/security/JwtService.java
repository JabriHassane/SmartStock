package com.smartstock.inventory.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/**
 * Vérifie les access tokens émis par auth-service avec la clé publique RS256
 * uniquement — ce service ne détient jamais la clé privée et ne peut donc
 * pas émettre de token (voir le secret "jwt_public_key" du compose).
 */
@Service
public class JwtService {

    private final PublicKey publicKey;
    private final String issuer;

    public JwtService(
            @Value("${app.jwt.public-key-path}") String publicKeyPath,
            @Value("${app.jwt.issuer}") String issuer,
            ResourceLoader resourceLoader) throws IOException, GeneralSecurityException {
        String pem;
        try (InputStream in = resourceLoader.getResource(publicKeyPath).getInputStream()) {
            pem = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        byte[] der = Base64.getDecoder().decode(pem
                .replaceAll("-----BEGIN (.*)-----", "")
                .replaceAll("-----END (.*)-----", "")
                .replaceAll("\\s", ""));
        this.publicKey = KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
        this.issuer = issuer;
    }

    /** Claims du token s'il est valide (signature, expiration, émetteur), vide sinon. */
    public Optional<Claims> parse(String token) {
        try {
            return Optional.of(Jwts.parser()
                    .verifyWith(publicKey)
                    .requireIssuer(issuer)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload());
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public static List<String> roles(Claims claims) {
        Object roles = claims.get("roles");
        return roles instanceof List<?> list ? list.stream().map(String::valueOf).toList() : List.of();
    }
}
