package com.smartstock.inventory.service;

import com.smartstock.inventory.dto.CatalogDtos.WarehouseRequest;
import com.smartstock.inventory.dto.CatalogDtos.WarehouseResponse;
import com.smartstock.inventory.entity.Warehouse;
import com.smartstock.inventory.exception.ConflictException;
import com.smartstock.inventory.exception.ResourceNotFoundException;
import com.smartstock.inventory.repository.StockLevelRepository;
import com.smartstock.inventory.repository.StockMovementRepository;
import com.smartstock.inventory.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;
    private final StockLevelRepository stockLevelRepository;
    private final StockMovementRepository stockMovementRepository;

    @Transactional(readOnly = true)
    public List<WarehouseResponse> list() {
        Map<Long, Object[]> totals = stockLevelRepository.warehouseTotals().stream()
                .collect(Collectors.toMap(r -> (Long) r[0], Function.identity()));
        return warehouseRepository.findAll(Sort.by("name")).stream()
                .map(w -> toResponse(w, totals.get(w.getId())))
                .toList();
    }

    @Transactional
    public WarehouseResponse create(WarehouseRequest request) {
        String code = request.code().trim().toUpperCase();
        if (warehouseRepository.existsByCodeIgnoreCase(code)) {
            throw new ConflictException("Un entrepôt utilise déjà ce code");
        }
        Warehouse warehouse = new Warehouse();
        apply(warehouse, request);
        return toResponse(warehouseRepository.save(warehouse), null);
    }

    @Transactional
    public WarehouseResponse update(Long id, WarehouseRequest request) {
        Warehouse warehouse = find(id);
        if (warehouseRepository.existsByCodeIgnoreCaseAndIdNot(request.code().trim(), id)) {
            throw new ConflictException("Un entrepôt utilise déjà ce code");
        }
        if (!request.active() && stockLevelRepository.existsByWarehouseIdAndQuantityOnHandGreaterThan(id, 0)) {
            throw new ConflictException("Impossible de désactiver un entrepôt qui contient encore du stock");
        }
        apply(warehouse, request);
        Object[] totals = stockLevelRepository.warehouseTotals().stream()
                .filter(r -> id.equals(r[0])).findFirst().orElse(null);
        return toResponse(warehouseRepository.save(warehouse), totals);
    }

    @Transactional
    public void delete(Long id) {
        Warehouse warehouse = find(id);
        if (stockMovementRepository.existsByWarehouseId(id)) {
            throw new ConflictException("Entrepôt avec historique de mouvements — désactivez-le plutôt");
        }
        stockLevelRepository.deleteAll(stockLevelRepository.findAll(
                (root, q, cb) -> cb.equal(root.get("warehouse").get("id"), id)));
        warehouseRepository.delete(warehouse);
    }

    Warehouse find(Long id) {
        return warehouseRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entrepôt introuvable: " + id));
    }

    private static void apply(Warehouse warehouse, WarehouseRequest request) {
        warehouse.setCode(request.code().trim().toUpperCase());
        warehouse.setName(request.name().trim());
        warehouse.setAddress(request.address());
        warehouse.setCity(request.city());
        warehouse.setActive(request.active());
    }

    private static WarehouseResponse toResponse(Warehouse w, Object[] totals) {
        long products = totals == null ? 0 : ((Number) totals[1]).longValue();
        long units = totals == null ? 0 : ((Number) totals[2]).longValue();
        BigDecimal value = totals == null || totals[3] == null ? BigDecimal.ZERO : (BigDecimal) totals[3];
        return new WarehouseResponse(w.getId(), w.getCode(), w.getName(), w.getAddress(), w.getCity(),
                w.isActive(), products, units, value, w.getCreatedAt());
    }
}
