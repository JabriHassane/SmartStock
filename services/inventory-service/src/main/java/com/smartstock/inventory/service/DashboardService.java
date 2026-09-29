package com.smartstock.inventory.service;

import com.smartstock.inventory.dto.CatalogDtos.StockStatus;
import com.smartstock.inventory.dto.DashboardDtos.CategoryShare;
import com.smartstock.inventory.dto.DashboardDtos.DailyFlow;
import com.smartstock.inventory.dto.DashboardDtos.DashboardResponse;
import com.smartstock.inventory.dto.DashboardDtos.Summary;
import com.smartstock.inventory.dto.DashboardDtos.TopProduct;
import com.smartstock.inventory.dto.StockDtos.AlertResponse;
import com.smartstock.inventory.entity.Product;
import com.smartstock.inventory.repository.CategoryRepository;
import com.smartstock.inventory.repository.ProductRepository;
import com.smartstock.inventory.repository.StockLevelRepository;
import com.smartstock.inventory.repository.StockMovementRepository;
import com.smartstock.inventory.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final WarehouseRepository warehouseRepository;
    private final StockLevelRepository stockLevelRepository;
    private final StockMovementRepository stockMovementRepository;
    private final StockService stockService;

    @Transactional(readOnly = true)
    public DashboardResponse dashboard(int days) {
        int window = Math.clamp(days, 7, 90);
        List<AlertResponse> alerts = stockService.alerts();

        Summary summary = new Summary(
                productRepository.countByActiveTrue(),
                categoryRepository.count(),
                warehouseRepository.countByActiveTrue(),
                stockLevelRepository.totalUnits(),
                stockLevelRepository.totalCostValue(),
                stockLevelRepository.totalSaleValue(),
                alerts.stream().filter(a -> a.status() == StockStatus.LOW).count(),
                alerts.stream().filter(a -> a.status() == StockStatus.OUT).count(),
                stockMovementRepository.countByCreatedAtGreaterThanEqual(StockService.startOfToday()));

        return new DashboardResponse(summary, flows(window), categories(), topProducts(),
                stockMovementRepository.findTop8ByOrderByCreatedAtDescIdDesc().stream()
                        .map(StockService::toMovementResponse).toList(),
                alerts.stream().limit(6).toList());
    }

    /** Une entrée par jour de la fenêtre, y compris les jours sans mouvement (pour le graphe). */
    private List<DailyFlow> flows(int days) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        LocalDate start = today.minusDays(days - 1L);
        Map<LocalDate, Object[]> byDay = new HashMap<>();
        for (Object[] row : stockMovementRepository.dailyFlows(start.atStartOfDay().toInstant(ZoneOffset.UTC))) {
            LocalDate day = row[0] instanceof Date d ? d.toLocalDate() : (LocalDate) row[0];
            byDay.put(day, row);
        }
        List<DailyFlow> flows = new ArrayList<>();
        for (LocalDate d = start; !d.isAfter(today); d = d.plusDays(1)) {
            Object[] row = byDay.get(d);
            flows.add(row == null ? new DailyFlow(d, 0, 0)
                    : new DailyFlow(d, ((Number) row[1]).longValue(), ((Number) row[2]).longValue()));
        }
        return flows;
    }

    private List<CategoryShare> categories() {
        return stockLevelRepository.categoryTotals().stream()
                .map(r -> new CategoryShare((Long) r[0], r[1] == null ? "Sans catégorie" : (String) r[1],
                        (String) r[2], r[3] == null ? BigDecimal.ZERO : (BigDecimal) r[3],
                        ((Number) r[4]).longValue(), ((Number) r[5]).longValue()))
                .toList();
    }

    private List<TopProduct> topProducts() {
        Map<Long, Product> products = productRepository.findAll().stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        return stockMovementRepository.outflowSince(ProductService.windowStart()).stream()
                .sorted(Comparator.comparingLong((Object[] r) -> ((Number) r[1]).longValue()).reversed())
                .limit(5)
                .map(r -> {
                    Product p = products.get((Long) r[0]);
                    return new TopProduct(p.getId(), p.getSku(), p.getName(), ((Number) r[1]).longValue());
                })
                .toList();
    }
}
