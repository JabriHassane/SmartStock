package com.smartstock.inventory.service;

import com.smartstock.inventory.dto.CatalogDtos.ProductInsight;
import com.smartstock.inventory.dto.CatalogDtos.StockStatus;
import com.smartstock.inventory.entity.Product;

/**
 * Règles de stock "intelligent" partagées par les produits, les alertes et
 * le dashboard : statut de stock, jours de couverture et quantité à
 * recommander à partir de la vélocité de sortie des 30 derniers jours.
 */
final class Forecasts {

    static final int VELOCITY_WINDOW_DAYS = 30;
    /** Horizon visé par une commande suggérée quand aucune quantité de réappro n'est définie. */
    static final int TARGET_COVER_DAYS = 30;

    private Forecasts() {
    }

    static StockStatus status(long quantity, int reorderPoint) {
        if (quantity <= 0) {
            return StockStatus.OUT;
        }
        return quantity <= reorderPoint ? StockStatus.LOW : StockStatus.IN_STOCK;
    }

    static ProductInsight insight(Product product, long quantity, long outflowOverWindow) {
        double avgDailyOut = (double) outflowOverWindow / VELOCITY_WINDOW_DAYS;
        Integer daysOfCover = avgDailyOut > 0 ? (int) Math.floor(quantity / avgDailyOut) : null;

        int suggested = 0;
        if (quantity <= product.getReorderPoint() || (daysOfCover != null && daysOfCover < 7)) {
            int byVelocity = (int) Math.ceil(avgDailyOut * TARGET_COVER_DAYS) - (int) quantity;
            int byRule = product.getReorderQuantity() > 0
                    ? product.getReorderQuantity()
                    : product.getReorderPoint() * 2 - (int) quantity;
            suggested = Math.max(0, Math.max(byVelocity, byRule));
        }
        return new ProductInsight(Math.round(avgDailyOut * 100) / 100.0, daysOfCover, suggested);
    }
}
