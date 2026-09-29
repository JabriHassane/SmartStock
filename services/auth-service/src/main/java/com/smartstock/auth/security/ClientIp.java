package com.smartstock.auth.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * IP du client pour le journal de sécurité. nginx (seul point d'entrée)
 * remplace X-Forwarded-For par l'IP réelle (CF-Connecting-IP derrière
 * Cloudflare) et server.forward-headers-strategy l'applique à getRemoteAddr().
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String current() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            return request.getRemoteAddr();
        }
        return "-";
    }
}
