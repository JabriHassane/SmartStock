package com.smartstock.inventory.controller;

import com.smartstock.inventory.dto.CatalogDtos.StockStatus;
import com.smartstock.inventory.dto.PageResponse;
import com.smartstock.inventory.dto.StockDtos.AlertResponse;
import com.smartstock.inventory.dto.StockDtos.BatchMovementRequest;
import com.smartstock.inventory.dto.StockDtos.MovementRequest;
import com.smartstock.inventory.dto.StockDtos.MovementResponse;
import com.smartstock.inventory.dto.StockDtos.StockLevelResponse;
import com.smartstock.inventory.dto.StockDtos.TransferRequest;
import com.smartstock.inventory.entity.MovementType;
import com.smartstock.inventory.security.InternalCallVerifier;
import com.smartstock.inventory.service.StockService;
import org.springframework.security.access.AccessDeniedException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Tous les rôles authentifiés (y compris MAGASINIER) peuvent enregistrer des
 * mouvements : c'est le cœur du travail en entrepôt. Chaque mouvement est
 * tracé avec l'utilisateur issu du JWT.
 */
@RestController
@RequestMapping("/api/stock")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;
    private final InternalCallVerifier internalCallVerifier;

    @GetMapping
    public PageResponse<StockLevelResponse> levels(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) StockStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return stockService.levels(search, warehouseId, status, page, size);
    }

    @GetMapping("/movements")
    public PageResponse<MovementResponse> movements(
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return stockService.movements(productId, warehouseId, type, from, to, search, page, size);
    }

    @PostMapping("/movements")
    public ResponseEntity<MovementResponse> record(@Valid @RequestBody MovementRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(stockService.record(request, auth.getName()));
    }

    @PostMapping("/transfers")
    public ResponseEntity<List<MovementResponse>> transfer(@Valid @RequestBody TransferRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(stockService.transfer(request, auth.getName()));
    }

    /** Réservé à order-service (secret interne) ; bloqué en plus par nginx côté public. */
    @PostMapping("/movements/batch")
    public ResponseEntity<List<MovementResponse>> batch(
            @RequestHeader(value = InternalCallVerifier.HEADER, required = false) String internalToken,
            @Valid @RequestBody BatchMovementRequest request, Authentication auth) {
        if (!internalCallVerifier.isTrusted(internalToken)) {
            throw new AccessDeniedException("Appel interne non autorisé");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(stockService.applyBatch(request, auth.getName()));
    }

    @GetMapping("/alerts")
    public List<AlertResponse> alerts() {
        return stockService.alerts();
    }
}
