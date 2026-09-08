package com.smartstock.auth.security;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Charge la paire de clés RSA (PKCS8/X509, PEM) utilisée pour signer les
 * access tokens JWT. auth-service détient les deux clés (signature +
 * vérification pour ses propres endpoints protégés) ; la gateway et les
 * autres services ne reçoivent que la clé publique (voir docker-compose.yml,
 * secret "jwt_public_key").
 */
@Component
public class RsaKeyProvider {

    @Getter
    private final PrivateKey privateKey;

    @Getter
    private final PublicKey publicKey;

    public RsaKeyProvider(
            @Value("${app.jwt.private-key-path}") String privateKeyPath,
            @Value("${app.jwt.public-key-path}") String publicKeyPath,
            ResourceLoader resourceLoader) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");

        byte[] privateKeyBytes = decodePem(readResource(resourceLoader, privateKeyPath));
        this.privateKey = keyFactory.generatePrivate(new PKCS8EncodedKeySpec(privateKeyBytes));

        byte[] publicKeyBytes = decodePem(readResource(resourceLoader, publicKeyPath));
        this.publicKey = keyFactory.generatePublic(new X509EncodedKeySpec(publicKeyBytes));
    }

    private static String readResource(ResourceLoader resourceLoader, String location) throws IOException {
        Resource resource = resourceLoader.getResource(location);
        try (InputStream in = resource.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static byte[] decodePem(String pem) {
        String base64 = pem
                .replaceAll("-----BEGIN (.*)-----", "")
                .replaceAll("-----END (.*)-----", "")
                .replaceAll("\\s", "");
        return Base64.getDecoder().decode(base64);
    }
}
