package com.smartstock.inventory.service;

import com.smartstock.inventory.dto.CatalogDtos.ProductDetailResponse;
import com.smartstock.inventory.dto.CatalogDtos.ProductOption;
import com.smartstock.inventory.dto.CatalogDtos.ProductRequest;
import com.smartstock.inventory.dto.CatalogDtos.ProductResponse;
import com.smartstock.inventory.dto.CatalogDtos.StockStatus;
import com.smartstock.inventory.dto.CatalogDtos.WarehouseStock;
import com.smartstock.inventory.dto.PageResponse;
import com.smartstock.inventory.entity.Category;
import com.smartstock.inventory.entity.Product;
import com.smartstock.inventory.entity.StockLevel;
import com.smartstock.inventory.exception.ConflictException;
import com.smartstock.inventory.exception.ResourceNotFoundException;
import com.smartstock.inventory.repository.ProductRepository;
import com.smartstock.inventory.repository.StockLevelRepository;
import com.smartstock.inventory.repository.StockMovementRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private static final Map<String, String> SORTABLE = Map.of(
            "name", "name", "sku", "sku", "unitPrice", "unitPrice", "updatedAt", "updatedAt", "createdAt", "createdAt");

    private final ProductRepository productRepository;
    private final StockLevelRepository stockLevelRepository;
    private final StockMovementRepository stockMovementRepository;
    private final CategoryService categoryService;

    @Transactional(readOnly = true)
    public PageResponse<ProductResponse> search(String search, Long categoryId, StockStatus status, Boolean active,
                                                int page, int size, String sort, String direction) {
        Sort order = Sort.by("desc".equalsIgnoreCase(direction) ? Sort.Direction.DESC : Sort.Direction.ASC,
                SORTABLE.getOrDefault(sort, "name"));
        Page<Product> result = productRepository.findAll(
                filter(search, categoryId, status, active),
                PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100), order));

        Map<Long, Long> totals = totals(result.getContent().stream().map(Product::getId).toList());
        return PageResponse.of(result, p -> toResponse(p, totals.getOrDefault(p.getId(), 0L)));
    }

    @Transactional(readOnly = true)
    public List<ProductOption> options() {
        return productRepository.findByActiveTrueOrderByName().stream()
                .map(p -> new ProductOption(p.getId(), p.getSku(), p.getName(), p.getUnitPrice(),
                        p.getCostPrice(), p.getUnitOfMeasure()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductDetailResponse get(Long id) {
        Product product = find(id);
        List<StockLevel> levels = stockLevelRepository.findByProductIdOrderByWarehouseName(id);
        long total = levels.stream().mapToLong(StockLevel::getQuantityOnHand).sum();
        long outflow = stockMovementRepository.outflowSince(windowStart()).stream()
                .filter(r -> id.equals(r[0])).mapToLong(r -> ((Number) r[1]).longValue()).sum();

        List<WarehouseStock> stock = levels.stream()
                .map(s -> new WarehouseStock(s.getWarehouse().getId(), s.getWarehouse().getCode(),
                        s.getWarehouse().getName(), s.getQuantityOnHand(), s.getQuantityReserved()))
                .toList();
        return new ProductDetailResponse(toResponse(product, total), stock, Forecasts.insight(product, total, outflow));
    }

    @Transactional
    public ProductResponse create(ProductRequest request) {
        if (productRepository.existsBySkuIgnoreCase(request.sku().trim())) {
            throw new ConflictException("Un produit utilise déjà ce SKU");
        }
        Product product = new Product();
        apply(product, request);
        return toResponse(productRepository.save(product), 0);
    }

    @Transactional
    public ProductResponse update(Long id, ProductRequest request) {
        Product product = find(id);
        if (productRepository.existsBySkuIgnoreCaseAndIdNot(request.sku().trim(), id)) {
            throw new ConflictException("Un produit utilise déjà ce SKU");
        }
        apply(product, request);
        return toResponse(productRepository.save(product), totals(List.of(id)).getOrDefault(id, 0L));
    }

    /** Suppression définitive seulement sans historique ; sinon il faut archiver (active = false). */
    @Transactional
    public void delete(Long id) {
        Product product = find(id);
        if (stockMovementRepository.existsByProductId(id)) {
            throw new ConflictException("Produit avec historique de mouvements — archivez-le plutôt");
        }
        productRepository.delete(product);
    }

    Product find(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produit introuvable: " + id));
    }

    static Instant windowStart() {
        return Instant.now().minus(Forecasts.VELOCITY_WINDOW_DAYS, ChronoUnit.DAYS);
    }

    private Map<Long, Long> totals(List<Long> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return stockLevelRepository.totalsForProducts(ids).stream()
                .collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).longValue()));
    }

    private void apply(Product product, ProductRequest request) {
        Category category = request.categoryId() == null ? null : categoryService.find(request.categoryId());
        product.setSku(request.sku().trim().toUpperCase());
        product.setBarcode(blankToNull(request.barcode()));
        product.setName(request.name().trim());
        product.setDescription(request.description());
        product.setCategory(category);
        product.setUnitPrice(request.unitPrice());
        product.setCostPrice(request.costPrice());
        product.setUnitOfMeasure(request.unitOfMeasure());
        product.setReorderPoint(request.reorderPoint());
        product.setReorderQuantity(request.reorderQuantity());
        product.setActive(request.active());
    }

    private static Specification<Product> filter(String search, Long categoryId, StockStatus status, Boolean active) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("sku")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("barcode"), "")), like)));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("id"), categoryId));
            }
            if (active != null) {
                predicates.add(cb.equal(root.get("active"), active));
            }
            if (status != null) {
                Subquery<Long> total = query.subquery(Long.class);
                Root<StockLevel> level = total.from(StockLevel.class);
                total.select(cb.coalesce(cb.sumAsLong(level.get("quantityOnHand")), 0L))
                        .where(cb.equal(level.get("product"), root));
                predicates.add(switch (status) {
                    case OUT -> cb.lessThanOrEqualTo(total, 0L);
                    case LOW -> cb.and(cb.greaterThan(total, 0L),
                            cb.lessThanOrEqualTo(total, root.get("reorderPoint").as(Long.class)));
                    case IN_STOCK -> cb.greaterThan(total, root.get("reorderPoint").as(Long.class));
                });
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static ProductResponse toResponse(Product p, long total) {
        Category c = p.getCategory();
        return new ProductResponse(p.getId(), p.getSku(), p.getBarcode(), p.getName(), p.getDescription(),
                c == null ? null : c.getId(), c == null ? null : c.getName(), c == null ? null : c.getColor(),
                p.getUnitPrice(), p.getCostPrice(), p.getUnitOfMeasure(), p.getReorderPoint(),
                p.getReorderQuantity(), p.isActive(), total, Forecasts.status(total, p.getReorderPoint()),
                p.getCreatedAt(), p.getUpdatedAt());
    }
}
