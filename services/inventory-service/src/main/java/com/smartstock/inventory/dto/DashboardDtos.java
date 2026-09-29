package com.smartstock.inventory.dto;

import com.smartstock.inventory.dto.StockDtos.AlertResponse;
import com.smartstock.inventory.dto.StockDtos.MovementResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class DashboardDtos {

    private DashboardDtos() {
    }

    public record Summary(
            long activeProducts,
            long categories,
            long warehouses,
            long totalUnits,
            BigDecimal stockValue,
            BigDecimal potentialRevenue,
            long lowStock,
            long outOfStock,
            long movementsToday) {
    }

    public record DailyFlow(LocalDate date, long in, long out) {
    }

    public record CategoryShare(Long categoryId, String name, String color, BigDecimal value, long units, long productCount) {
    }

    public record TopProduct(Long productId, String sku, String name, long outQuantity) {
    }

    public record DashboardResponse(
            Summary summary,
            List<DailyFlow> flows,
            List<CategoryShare> categories,
            List<TopProduct> topProducts,
            List<MovementResponse> recentMovements,
            List<AlertResponse> alerts) {
    }
}
