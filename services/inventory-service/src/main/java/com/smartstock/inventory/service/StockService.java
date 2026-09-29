package com.smartstock.inventory.service;

import com.smartstock.inventory.dto.CatalogDtos.ProductInsight;
import com.smartstock.inventory.dto.CatalogDtos.StockStatus;
import com.smartstock.inventory.dto.PageResponse;
import com.smartstock.inventory.dto.StockDtos.AlertResponse;
import com.smartstock.inventory.dto.StockDtos.BatchLine;
import com.smartstock.inventory.dto.StockDtos.BatchMovementRequest;
import com.smartstock.inventory.dto.StockDtos.Direction;
import com.smartstock.inventory.dto.StockDtos.MovementRequest;
import com.smartstock.inventory.dto.StockDtos.MovementResponse;
import com.smartstock.inventory.dto.StockDtos.StockLevelResponse;
import com.smartstock.inventory.dto.StockDtos.TransferRequest;
import com.smartstock.inventory.entity.MovementType;
import com.smartstock.inventory.entity.Product;
import com.smartstock.inventory.entity.ReferenceType;
import com.smartstock.inventory.entity.StockLevel;
import com.smartstock.inventory.entity.StockMovement;
import com.smartstock.inventory.entity.Warehouse;
import com.smartstock.inventory.exception.ConflictException;
import com.smartstock.inventory.exception.InsufficientStockException;
import com.smartstock.inventory.repository.ProductRepository;
import com.smartstock.inventory.repository.StockLevelRepository;
import com.smartstock.inventory.repository.StockMovementRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StockService {

    private final StockLevelRepository stockLevelRepository;
    private final StockMovementRepository stockMovementRepository;
    private final ProductRepository productRepository;
    private final ProductService productService;
    private final WarehouseService warehouseService;

    // ------------------------------------------------------------------
    // Lecture
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<StockLevelResponse> levels(String search, Long warehouseId, StockStatus status,
                                                   int page, int size) {
        Specification<StockLevel> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            var product = root.get("product");
            predicates.add(cb.isTrue(product.get("active")));
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(cb.like(cb.lower(product.get("name")), like),
                        cb.like(cb.lower(product.get("sku")), like)));
            }
            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouse").get("id"), warehouseId));
            }
            if (status != null) {
                var qty = root.<Integer>get("quantityOnHand");
                var reorder = product.<Integer>get("reorderPoint");
                predicates.add(switch (status) {
                    case OUT -> cb.lessThanOrEqualTo(qty, 0);
                    case LOW -> cb.and(cb.greaterThan(qty, 0), cb.lessThanOrEqualTo(qty, reorder));
                    case IN_STOCK -> cb.greaterThan(qty, reorder);
                });
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var result = stockLevelRepository.findAll(spec, PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100),
                Sort.by("product.name", "warehouse.name")));
        return PageResponse.of(result, StockService::toLevelResponse);
    }

    @Transactional(readOnly = true)
    public PageResponse<MovementResponse> movements(Long productId, Long warehouseId, MovementType type,
                                                    LocalDate from, LocalDate to, String search, int page, int size) {
        Specification<StockMovement> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (productId != null) {
                predicates.add(cb.equal(root.get("product").get("id"), productId));
            }
            if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouse").get("id"), warehouseId));
            }
            if (type != null) {
                predicates.add(cb.equal(root.get("type"), type));
            }
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay().toInstant(ZoneOffset.UTC)));
            }
            if (to != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC)));
            }
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("product").get("name")), like),
                        cb.like(cb.lower(root.get("product").get("sku")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("referenceId"), "")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("reason"), "")), like)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var result = stockMovementRepository.findAll(spec, PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100),
                Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return PageResponse.of(result, StockService::toMovementResponse);
    }

    /** Produits actifs en stock bas ou en rupture, triés par urgence (couverture restante). */
    @Transactional(readOnly = true)
    public List<AlertResponse> alerts() {
        Map<Long, Long> totals = stockLevelRepository.totalsForActiveProducts().stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).longValue()));
        Map<Long, Long> outflows = stockMovementRepository.outflowSince(ProductService.windowStart()).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).longValue()));

        List<AlertResponse> alerts = new ArrayList<>();
        for (Product p : productRepository.findByActiveTrueOrderByName()) {
            long qty = totals.getOrDefault(p.getId(), 0L);
            StockStatus status = Forecasts.status(qty, p.getReorderPoint());
            ProductInsight insight = Forecasts.insight(p, qty, outflows.getOrDefault(p.getId(), 0L));
            boolean runningOut = insight.daysOfCover() != null && insight.daysOfCover() < 7;
            if (status == StockStatus.IN_STOCK && !runningOut) {
                continue;
            }
            alerts.add(new AlertResponse(p.getId(), p.getSku(), p.getName(),
                    p.getCategory() == null ? null : p.getCategory().getName(), qty, p.getReorderPoint(),
                    p.getReorderQuantity(), status, insight.avgDailyOut(), insight.daysOfCover(),
                    insight.suggestedReorder()));
        }
        alerts.sort(Comparator.comparing((AlertResponse a) -> a.status() != StockStatus.OUT)
                .thenComparing(a -> a.daysOfCover() == null ? Integer.MAX_VALUE : a.daysOfCover())
                .thenComparing(AlertResponse::totalQuantity));
        return alerts;
    }

    // ------------------------------------------------------------------
    // Écriture
    // ------------------------------------------------------------------

    @Transactional
    public MovementResponse record(MovementRequest request, String username) {
        Product product = productService.find(request.productId());
        Warehouse warehouse = activeWarehouse(request.warehouseId());
        StockLevel level = lockLevel(product, warehouse);

        int delta = switch (request.type()) {
            case IN -> request.quantity();
            case OUT -> -request.quantity();
            case ADJUSTMENT -> request.quantity() - level.getQuantityOnHand();
            case TRANSFER_IN, TRANSFER_OUT ->
                    throw new IllegalArgumentException("Utilisez /api/stock/transfers pour un transfert");
        };
        if (request.type() != MovementType.ADJUSTMENT && request.quantity() <= 0) {
            throw new IllegalArgumentException("La quantité doit être supérieure à 0");
        }
        if (delta == 0) {
            throw new IllegalArgumentException("Le stock compté est identique au stock actuel");
        }
        String reference = request.reference() == null || request.reference().isBlank() ? null : request.reference().trim();
        ReferenceType refType = request.type() == MovementType.ADJUSTMENT ? ReferenceType.INVENTORY_COUNT : ReferenceType.MANUAL;
        return toMovementResponse(apply(level, request.type(), delta, request.unitCost(), refType, reference,
                request.reason(), username));
    }

    @Transactional
    public List<MovementResponse> transfer(TransferRequest request, String username) {
        if (request.fromWarehouseId().equals(request.toWarehouseId())) {
            throw new IllegalArgumentException("Les entrepôts source et destination doivent être différents");
        }
        Product product = productService.find(request.productId());
        Warehouse from = activeWarehouse(request.fromWarehouseId());
        Warehouse to = activeWarehouse(request.toWarehouseId());

        // Verrouillage dans un ordre stable (id croissant) pour éviter tout interblocage
        // entre deux transferts croisés A→B et B→A.
        StockLevel source;
        StockLevel target;
        if (from.getId() < to.getId()) {
            source = lockLevel(product, from);
            target = lockLevel(product, to);
        } else {
            target = lockLevel(product, to);
            source = lockLevel(product, from);
        }
        String reference = "TR-" + System.currentTimeMillis();
        String reason = request.reason() == null || request.reason().isBlank()
                ? from.getCode() + " → " + to.getCode() : request.reason();
        StockMovement out = apply(source, MovementType.TRANSFER_OUT, -request.quantity(), product.getCostPrice(),
                ReferenceType.TRANSFER, reference, reason, username);
        StockMovement in = apply(target, MovementType.TRANSFER_IN, request.quantity(), product.getCostPrice(),
                ReferenceType.TRANSFER, reference, reason, username);
        return List.of(toMovementResponse(out), toMovementResponse(in));
    }

    /**
     * Réception (IN) ou expédition (OUT) d'une commande, tout ou rien. Idempotent
     * par (referenceType, referenceId) : un second appel pour la même commande
     * est refusé au lieu de doubler le stock.
     */
    @Transactional
    public List<MovementResponse> applyBatch(BatchMovementRequest request, String username) {
        if (request.referenceType() != ReferenceType.PURCHASE_ORDER && request.referenceType() != ReferenceType.SALES_ORDER) {
            throw new IllegalArgumentException("Type de référence non supporté pour un lot");
        }
        if (stockMovementRepository.existsByReferenceTypeAndReferenceId(request.referenceType(), request.referenceId())) {
            throw new ConflictException("Les mouvements de " + request.referenceId() + " ont déjà été enregistrés");
        }
        Warehouse warehouse = activeWarehouse(request.warehouseId());
        MovementType type = request.direction() == Direction.IN ? MovementType.IN : MovementType.OUT;

        // Regroupe les lignes d'un même produit, puis verrouille par id croissant.
        Map<Long, Integer> quantities = request.lines().stream()
                .collect(Collectors.groupingBy(BatchLine::productId, java.util.TreeMap::new,
                        Collectors.summingInt(BatchLine::quantity)));
        Map<Long, BigDecimal> costs = request.lines().stream().filter(l -> l.unitCost() != null)
                .collect(Collectors.toMap(BatchLine::productId, BatchLine::unitCost, (a, b) -> a));

        List<MovementResponse> result = new ArrayList<>();
        for (var entry : quantities.entrySet()) {
            Product product = productService.find(entry.getKey());
            StockLevel level = lockLevel(product, warehouse);
            int delta = type == MovementType.IN ? entry.getValue() : -entry.getValue();
            BigDecimal cost = costs.getOrDefault(product.getId(), product.getCostPrice());
            result.add(toMovementResponse(apply(level, type, delta, cost, request.referenceType(),
                    request.referenceId(), request.reason(), username)));
        }
        return result;
    }

    private StockMovement apply(StockLevel level, MovementType type, int delta, BigDecimal unitCost,
                                ReferenceType referenceType, String referenceId, String reason, String username) {
        int newQuantity = level.getQuantityOnHand() + delta;
        if (newQuantity < 0) {
            throw new InsufficientStockException("Stock insuffisant pour " + level.getProduct().getSku()
                    + " dans " + level.getWarehouse().getCode() + " (disponible : " + level.getQuantityOnHand()
                    + ", demandé : " + (-delta) + ")");
        }
        level.setQuantityOnHand(newQuantity);
        stockLevelRepository.save(level);

        StockMovement movement = new StockMovement();
        movement.setProduct(level.getProduct());
        movement.setWarehouse(level.getWarehouse());
        movement.setType(type);
        movement.setQuantity(delta);
        movement.setQuantityAfter(newQuantity);
        movement.setUnitCost(unitCost);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setReason(reason == null || reason.isBlank() ? null : reason.trim());
        movement.setCreatedBy(username);
        return stockMovementRepository.save(movement);
    }

    private StockLevel lockLevel(Product product, Warehouse warehouse) {
        if (!product.isActive()) {
            throw new ConflictException("Le produit " + product.getSku() + " est archivé");
        }
        return stockLevelRepository.findForUpdate(product.getId(), warehouse.getId())
                .orElseGet(() -> {
                    stockLevelRepository.saveAndFlush(new StockLevel(product, warehouse));
                    return stockLevelRepository.findForUpdate(product.getId(), warehouse.getId()).orElseThrow();
                });
    }

    private Warehouse activeWarehouse(Long id) {
        Warehouse warehouse = warehouseService.find(id);
        if (!warehouse.isActive()) {
            throw new ConflictException("L'entrepôt " + warehouse.getCode() + " est désactivé");
        }
        return warehouse;
    }

    static StockLevelResponse toLevelResponse(StockLevel s) {
        Product p = s.getProduct();
        Warehouse w = s.getWarehouse();
        return new StockLevelResponse(s.getId(), p.getId(), p.getSku(), p.getName(),
                p.getCategory() == null ? null : p.getCategory().getName(), p.getUnitOfMeasure(),
                w.getId(), w.getCode(), w.getName(), s.getQuantityOnHand(), s.getQuantityReserved(),
                p.getReorderPoint(), p.getCostPrice().multiply(BigDecimal.valueOf(s.getQuantityOnHand())),
                Forecasts.status(s.getQuantityOnHand(), p.getReorderPoint()), s.getUpdatedAt());
    }

    static MovementResponse toMovementResponse(StockMovement m) {
        Product p = m.getProduct();
        Warehouse w = m.getWarehouse();
        return new MovementResponse(m.getId(), p.getId(), p.getSku(), p.getName(), w.getId(), w.getCode(),
                w.getName(), m.getType(), m.getQuantity(), m.getQuantityAfter(), m.getUnitCost(),
                m.getReferenceType(), m.getReferenceId(), m.getReason(), m.getCreatedBy(), m.getCreatedAt());
    }

    static Instant startOfToday() {
        return LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}
