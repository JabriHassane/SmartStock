package com.smartstock.order.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.smartstock.order.exception.InventoryException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Appels synchrones vers inventory-service sur le réseau Docker interne. Le
 * JWT de l'utilisateur est relayé tel quel : inventory-service applique ses
 * propres règles d'accès et trace le mouvement au nom de cet utilisateur.
 */
@Component
public class InventoryClient {

    private final RestClient restClient;

    private final String internalToken;

    public InventoryClient(@Value("${inventory.base-url}") String baseUrl,
                           @Value("${app.internal-token:}") String internalToken) {
        this.restClient = RestClient.create(baseUrl);
        this.internalToken = internalToken;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProductRef(Long id, String sku, String name, BigDecimal unitPrice, BigDecimal costPrice) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record WarehouseRef(Long id, String code, String name, boolean active) {
    }

    public record BatchLine(Long productId, int quantity, BigDecimal unitCost) {
    }

    public record BatchRequest(String referenceType, String referenceId, Long warehouseId, String direction,
                               String reason, List<BatchLine> lines) {
    }

    public List<ProductRef> products() {
        return call(() -> restClient.get().uri("/api/products/options")
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .retrieve()
                .body(new ParameterizedTypeReference<List<ProductRef>>() { }));
    }

    public List<WarehouseRef> warehouses() {
        return call(() -> restClient.get().uri("/api/warehouses")
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .retrieve()
                .body(new ParameterizedTypeReference<List<WarehouseRef>>() { }));
    }

    public void applyBatch(BatchRequest request) {
        call(() -> restClient.post().uri("/api/stock/movements/batch")
                .header(HttpHeaders.AUTHORIZATION, bearer())
                .header("X-Internal-Token", internalToken)
                .body(request)
                .retrieve()
                .toBodilessEntity());
    }

    private static <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException e) {
            String message = "Erreur du service d'inventaire";
            try {
                Map<?, ?> body = e.getResponseBodyAs(Map.class);
                if (body != null && body.get("message") instanceof String m) {
                    message = m;
                }
            } catch (RuntimeException ignored) {
                // corps illisible : on garde le message générique
            }
            int status = e.getStatusCode().is5xxServerError() ? 502 : e.getStatusCode().value();
            throw new InventoryException(status, message);
        } catch (RestClientException e) {
            throw new InventoryException(503, "Service d'inventaire indisponible");
        }
    }

    private static String bearer() {
        var attributes = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
        HttpServletRequest request = attributes.getRequest();
        return request.getHeader(HttpHeaders.AUTHORIZATION);
    }
}
