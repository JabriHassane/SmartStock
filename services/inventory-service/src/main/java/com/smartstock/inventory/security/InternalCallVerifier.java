package com.smartstock.inventory.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Authentifie les appels service-à-service (order-service → inventory-service)
 * par un secret partagé, en plus du JWT de l'utilisateur. Sans lui, n'importe
 * quel utilisateur connecté pourrait appeler l'endpoint de lot avec un faux
 * numéro de commande et fausser la réception/l'expédition réelle.
 */
@Component
public class InternalCallVerifier {

    public static final String HEADER = "X-Internal-Token";

    private final byte[] expected;

    public InternalCallVerifier(@Value("${app.internal-token:}") String token) {
        this.expected = token.getBytes(StandardCharsets.UTF_8);
    }

    /** Comparaison à temps constant ; un secret non configuré (ou trop court) refuse tout. */
    public boolean isTrusted(String provided) {
        if (expected.length < 32 || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(expected, provided.getBytes(StandardCharsets.UTF_8));
    }
}
