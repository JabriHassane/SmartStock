package com.smartstock.inventory.dto;

import com.smartstock.inventory.dto.CatalogDtos.StockStatus;
import com.smartstock.inventory.entity.MovementType;
import com.smartstock.inventory.entity.ReferenceType;
import com.smartstock.inventory.entity.UnitOfMeasure;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class StockDtos {

    private StockDtos() {
    }

    public enum Direction { IN, OUT }

    /**
     * Mouvement manuel. Pour IN/OUT, `quantity` est la quantité déplacée ;
     * pour ADJUSTMENT (inventaire physique), c'est la quantité comptée — le
     * service enregistre l'écart.
     */
    public record MovementRequest(
            @NotNull Long productId,
            @NotNull Long warehouseId,
            @NotNull MovementType type,
            @Min(0) @Max(100_000_000) int quantity,
            @DecimalMin("0.00") @DecimalMax("9999999999.99") BigDecimal unitCost,
            @Size(max = 255) String reason,
            @Size(max = 64) String reference) {
    }

    public record TransferRequest(
            @NotNull Long productId,
            @NotNull Long fromWarehouseId,
            @NotNull Long toWarehouseId,
            @Min(1) @Max(100_000_000) int quantity,
            @Size(max = 255) String reason) {
    }

    public record BatchLine(
            @NotNull Long productId,
            @Min(1) @Max(100_000_000) int quantity,
            @DecimalMin("0.00") @DecimalMax("9999999999.99") BigDecimal unitCost) {
    }

    /** Appliqué atomiquement par order-service à la réception/expédition d'une commande. */
    public record BatchMovementRequest(
            @NotNull ReferenceType referenceType,
            @NotBlank @Size(max = 64) String referenceId,
            @NotNull Long warehouseId,
            @NotNull Direction direction,
            @Size(max = 255) String reason,
            @NotEmpty @Size(max = 500) List<@Valid @NotNull BatchLine> lines) {
    }

    public record StockLevelResponse(
            Long id,
            Long productId,
            String sku,
            String productName,
            String categoryName,
            UnitOfMeasure unitOfMeasure,
            Long warehouseId,
            String warehouseCode,
            String warehouseName,
            int quantityOnHand,
            int quantityReserved,
            int reorderPoint,
            BigDecimal stockValue,
            StockStatus status,
            Instant updatedAt) {
    }

    public record MovementResponse(
            Long id,
            Long productId,
            String sku,
            String productName,
            Long warehouseId,
            String warehouseCode,
            String warehouseName,
            MovementType type,
            int quantity,
            int quantityAfter,
            BigDecimal unitCost,
            ReferenceType referenceType,
            String referenceId,
            String reason,
            String createdBy,
            Instant createdAt) {
    }

    public record AlertResponse(
            Long productId,
            String sku,
            String productName,
            String categoryName,
            long totalQuantity,
            int reorderPoint,
            int reorderQuantity,
            StockStatus status,
            double avgDailyOut,
            Integer daysOfCover,
            int suggestedReorder) {
    }
}
