package com.smartstock.order.dto;

import com.smartstock.order.entity.OrderStatus;
import com.smartstock.order.entity.OrderType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class OrderDtos {

    private OrderDtos() {
    }

    public record OrderLineRequest(
            @NotNull Long productId,
            @Min(1) @Max(100_000_000) int quantity,
            @NotNull @DecimalMin("0.00") @DecimalMax("9999999999.99") BigDecimal unitPrice) {
    }

    /** partnerId = fournisseur pour un achat, client pour une vente. */
    public record OrderRequest(
            @NotNull OrderType type,
            @NotNull Long partnerId,
            @NotNull Long warehouseId,
            LocalDate orderDate,
            LocalDate expectedDate,
            @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal taxRate,
            @Size(max = 2000) String notes,
            @NotEmpty @Size(max = 200) List<@Valid @NotNull OrderLineRequest> lines) {
    }

    public record OrderLineResponse(
            Long id,
            Long productId,
            String sku,
            String productName,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal lineTotal) {
    }

    public record OrderSummary(
            Long id,
            String orderNumber,
            OrderType type,
            OrderStatus status,
            Long partnerId,
            String partnerName,
            Long warehouseId,
            String warehouseName,
            LocalDate orderDate,
            LocalDate expectedDate,
            BigDecimal totalHt,
            BigDecimal totalTtc,
            String createdBy,
            Instant createdAt) {
    }

    public record OrderResponse(
            Long id,
            String orderNumber,
            OrderType type,
            OrderStatus status,
            Long partnerId,
            String partnerName,
            Long warehouseId,
            String warehouseName,
            LocalDate orderDate,
            LocalDate expectedDate,
            BigDecimal taxRate,
            BigDecimal totalHt,
            BigDecimal totalTax,
            BigDecimal totalTtc,
            String notes,
            String createdBy,
            String completedBy,
            Instant confirmedAt,
            Instant completedAt,
            Instant cancelledAt,
            Instant createdAt,
            List<OrderLineResponse> lines) {
    }

    public record MonthlyTotal(LocalDate month, BigDecimal purchases, BigDecimal sales) {
    }

    public record OrderDashboard(
            long pendingPurchases,
            long pendingSales,
            BigDecimal purchasesThisMonth,
            BigDecimal salesThisMonth,
            List<MonthlyTotal> monthly,
            List<OrderSummary> recent) {
    }
}
