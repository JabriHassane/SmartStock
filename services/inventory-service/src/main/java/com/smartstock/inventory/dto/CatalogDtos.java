package com.smartstock.inventory.dto;

import com.smartstock.inventory.entity.UnitOfMeasure;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class CatalogDtos {

    private CatalogDtos() {
    }

    public enum StockStatus { IN_STOCK, LOW, OUT }

    public record CategoryRequest(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 1000) String description,
            @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "couleur hexadécimale attendue (#RRGGBB)") String color,
            Long parentId) {
    }

    public record CategoryResponse(
            Long id,
            String name,
            String description,
            String color,
            Long parentId,
            String parentName,
            long productCount,
            Instant createdAt) {
    }

    public record ProductRequest(
            @NotBlank @Size(max = 64) String sku,
            @Size(max = 64) String barcode,
            @NotBlank @Size(max = 200) String name,
            @Size(max = 5000) String description,
            Long categoryId,
            @NotNull @DecimalMin("0.00") @DecimalMax("9999999999.99") BigDecimal unitPrice,
            @NotNull @DecimalMin("0.00") @DecimalMax("9999999999.99") BigDecimal costPrice,
            @NotNull UnitOfMeasure unitOfMeasure,
            @Min(0) @Max(100_000_000) int reorderPoint,
            @Min(0) @Max(100_000_000) int reorderQuantity,
            boolean active) {
    }

    public record ProductResponse(
            Long id,
            String sku,
            String barcode,
            String name,
            String description,
            Long categoryId,
            String categoryName,
            String categoryColor,
            BigDecimal unitPrice,
            BigDecimal costPrice,
            UnitOfMeasure unitOfMeasure,
            int reorderPoint,
            int reorderQuantity,
            boolean active,
            long totalQuantity,
            StockStatus stockStatus,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record WarehouseStock(
            Long warehouseId,
            String warehouseCode,
            String warehouseName,
            int quantityOnHand,
            int quantityReserved) {
    }

    /**
     * Prévision simple : vélocité de sortie moyenne sur 30 jours, nombre de
     * jours de couverture restants et quantité de réapprovisionnement suggérée.
     */
    public record ProductInsight(
            double avgDailyOut,
            Integer daysOfCover,
            int suggestedReorder) {
    }

    public record ProductDetailResponse(
            ProductResponse product,
            List<WarehouseStock> stock,
            ProductInsight insight) {
    }

    /** Liste légère pour les sélecteurs (formulaires de mouvement, commandes). */
    public record ProductOption(
            Long id,
            String sku,
            String name,
            BigDecimal unitPrice,
            BigDecimal costPrice,
            UnitOfMeasure unitOfMeasure) {
    }

    public record WarehouseRequest(
            @NotBlank @Size(max = 20) String code,
            @NotBlank @Size(max = 120) String name,
            @Size(max = 255) String address,
            @Size(max = 120) String city,
            boolean active) {
    }

    public record WarehouseResponse(
            Long id,
            String code,
            String name,
            String address,
            String city,
            boolean active,
            long productCount,
            long totalUnits,
            BigDecimal stockValue,
            Instant createdAt) {
    }
}
