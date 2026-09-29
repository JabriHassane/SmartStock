package com.smartstock.order.controller;

import com.smartstock.order.dto.OrderDtos.OrderDashboard;
import com.smartstock.order.dto.OrderDtos.OrderRequest;
import com.smartstock.order.dto.OrderDtos.OrderResponse;
import com.smartstock.order.dto.OrderDtos.OrderSummary;
import com.smartstock.order.dto.PageResponse;
import com.smartstock.order.entity.OrderStatus;
import com.smartstock.order.entity.OrderType;
import com.smartstock.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping("/api/orders")
    public PageResponse<OrderSummary> search(
            @RequestParam(required = false) OrderType type,
            @RequestParam(required = false) OrderStatus status,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return orderService.search(type, status, search, page, size);
    }

    @GetMapping("/api/orders/{id}")
    public OrderResponse get(@PathVariable Long id) {
        return orderService.get(id);
    }

    @PostMapping("/api/orders")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<OrderResponse> create(@Valid @RequestBody OrderRequest request, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(orderService.create(request, auth.getName()));
    }

    @PutMapping("/api/orders/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public OrderResponse update(@PathVariable Long id, @Valid @RequestBody OrderRequest request) {
        return orderService.update(id, request);
    }

    @PostMapping("/api/orders/{id}/confirm")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public OrderResponse confirm(@PathVariable Long id) {
        return orderService.confirm(id);
    }

    /** Réception/expédition physique : ouverte au Magasinier. */
    @PostMapping("/api/orders/{id}/complete")
    public OrderResponse complete(@PathVariable Long id, Authentication auth) {
        return orderService.complete(id, auth.getName());
    }

    @PostMapping("/api/orders/{id}/cancel")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public OrderResponse cancel(@PathVariable Long id) {
        return orderService.cancel(id);
    }

    @DeleteMapping("/api/orders/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        orderService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/dashboard/orders")
    public OrderDashboard dashboard() {
        return orderService.dashboard();
    }
}
