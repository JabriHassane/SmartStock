package com.smartstock.order.service;

import com.smartstock.order.client.InventoryClient;
import com.smartstock.order.client.InventoryClient.BatchLine;
import com.smartstock.order.client.InventoryClient.BatchRequest;
import com.smartstock.order.client.InventoryClient.ProductRef;
import com.smartstock.order.client.InventoryClient.WarehouseRef;
import com.smartstock.order.dto.OrderDtos.MonthlyTotal;
import com.smartstock.order.dto.OrderDtos.OrderDashboard;
import com.smartstock.order.dto.OrderDtos.OrderLineRequest;
import com.smartstock.order.dto.OrderDtos.OrderLineResponse;
import com.smartstock.order.dto.OrderDtos.OrderRequest;
import com.smartstock.order.dto.OrderDtos.OrderResponse;
import com.smartstock.order.dto.OrderDtos.OrderSummary;
import com.smartstock.order.dto.PageResponse;
import com.smartstock.order.entity.OrderLine;
import com.smartstock.order.entity.OrderStatus;
import com.smartstock.order.entity.OrderType;
import com.smartstock.order.entity.Partner;
import com.smartstock.order.entity.PurchaseOrder;
import com.smartstock.order.exception.ConflictException;
import com.smartstock.order.exception.InventoryException;
import com.smartstock.order.exception.ResourceNotFoundException;
import com.smartstock.order.repository.OrderRepository;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final OrderRepository orderRepository;
    private final PartnerService partnerService;
    private final InventoryClient inventoryClient;

    @Transactional(readOnly = true)
    public PageResponse<OrderSummary> search(OrderType type, OrderStatus status, String search, int page, int size) {
        Specification<PurchaseOrder> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (type != null) {
                predicates.add(cb.equal(root.get("type"), type));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase() + "%";
                var supplier = root.join("supplier", JoinType.LEFT);
                var customer = root.join("customer", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("orderNumber")), like),
                        cb.like(cb.lower(cb.coalesce(supplier.get("name"), "")), like),
                        cb.like(cb.lower(cb.coalesce(customer.get("name"), "")), like)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var result = orderRepository.findAll(spec, PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, 100),
                Sort.by(Sort.Direction.DESC, "createdAt")));
        return PageResponse.of(result, OrderService::toSummary);
    }

    @Transactional(readOnly = true)
    public OrderResponse get(Long id) {
        return toResponse(find(id));
    }

    @Transactional
    public OrderResponse create(OrderRequest request, String username) {
        PurchaseOrder order = new PurchaseOrder();
        order.setType(request.type());
        order.setCreatedBy(username);
        apply(order, request);
        order.setOrderNumber(nextNumber(request.type()));
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse update(Long id, OrderRequest request) {
        PurchaseOrder order = find(id);
        requireStatus(order, OrderStatus.DRAFT, "Seul un brouillon peut être modifié");
        if (order.getType() != request.type()) {
            throw new IllegalArgumentException("Le type d'une commande ne peut pas changer");
        }
        apply(order, request);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse confirm(Long id) {
        PurchaseOrder order = find(id);
        requireStatus(order, OrderStatus.DRAFT, "Seul un brouillon peut être confirmé");
        order.setStatus(OrderStatus.CONFIRMED);
        order.setConfirmedAt(Instant.now());
        return toResponse(orderRepository.save(order));
    }

    /**
     * Réception (achat) ou expédition (vente) : applique les mouvements de
     * stock dans inventory-service, puis passe la commande en COMPLETED. Si
     * l'inventaire refuse (stock insuffisant...), la commande reste CONFIRMED.
     * L'appel est idempotent côté inventaire (référence = numéro de commande).
     */
    @Transactional
    public OrderResponse complete(Long id, String username) {
        PurchaseOrder order = find(id);
        requireStatus(order, OrderStatus.CONFIRMED, "Seule une commande confirmée peut être réceptionnée/expédiée");

        boolean purchase = order.getType() == OrderType.PURCHASE;
        try {
            inventoryClient.applyBatch(new BatchRequest(
                purchase ? "PURCHASE_ORDER" : "SALES_ORDER",
                order.getOrderNumber(),
                order.getWarehouseId(),
                purchase ? "IN" : "OUT",
                (purchase ? "Réception " : "Expédition ") + order.getOrderNumber() + " — " + order.getPartner().getName(),
                order.getLines().stream()
                        .map(l -> new BatchLine(l.getProductId(), l.getQuantity(), purchase ? l.getUnitPrice() : null))
                        .toList()));
        } catch (InventoryException e) {
            // 409 = mouvements déjà enregistrés pour ce numéro (ex. un précédent appel a
            // réussi côté inventaire mais la mise à jour de la commande a échoué) : le
            // stock est déjà à jour, il ne reste qu'à terminer la commande.
            if (e.getStatus() != 409) {
                throw e;
            }
        }

        order.setStatus(OrderStatus.COMPLETED);
        order.setCompletedAt(Instant.now());
        order.setCompletedBy(username);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse cancel(Long id) {
        PurchaseOrder order = find(id);
        if (order.getStatus() != OrderStatus.DRAFT && order.getStatus() != OrderStatus.CONFIRMED) {
            throw new ConflictException("Une commande terminée ou déjà annulée ne peut pas être annulée");
        }
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelledAt(Instant.now());
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public void delete(Long id) {
        PurchaseOrder order = find(id);
        if (order.getStatus() != OrderStatus.DRAFT && order.getStatus() != OrderStatus.CANCELLED) {
            throw new ConflictException("Seuls les brouillons et commandes annulées peuvent être supprimés");
        }
        orderRepository.delete(order);
    }

    @Transactional(readOnly = true)
    public OrderDashboard dashboard() {
        var pending = EnumSet.of(OrderStatus.DRAFT, OrderStatus.CONFIRMED);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Instant monthStart = today.withDayOfMonth(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        LocalDate firstMonth = today.withDayOfMonth(1).minusMonths(5);

        Map<LocalDate, BigDecimal[]> byMonth = new HashMap<>();
        for (Object[] row : orderRepository.monthlyTotals(firstMonth.atStartOfDay().toInstant(ZoneOffset.UTC))) {
            LocalDate month = row[0] instanceof Date d ? d.toLocalDate() : (LocalDate) row[0];
            BigDecimal[] totals = byMonth.computeIfAbsent(month, m -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            totals["PURCHASE".equals(row[1]) ? 0 : 1] = (BigDecimal) row[2];
        }
        List<MonthlyTotal> monthly = new ArrayList<>();
        for (LocalDate m = firstMonth; !m.isAfter(today); m = m.plusMonths(1)) {
            BigDecimal[] totals = byMonth.getOrDefault(m, new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            monthly.add(new MonthlyTotal(m, totals[0], totals[1]));
        }

        return new OrderDashboard(
                orderRepository.countByTypeAndStatusIn(OrderType.PURCHASE, pending),
                orderRepository.countByTypeAndStatusIn(OrderType.SALE, pending),
                orderRepository.completedTotalSince(OrderType.PURCHASE, monthStart),
                orderRepository.completedTotalSince(OrderType.SALE, monthStart),
                monthly,
                orderRepository.findTop6ByOrderByCreatedAtDesc().stream().map(OrderService::toSummary).toList());
    }

    private void apply(PurchaseOrder order, OrderRequest request) {
        if (order.getType() == OrderType.PURCHASE) {
            order.setSupplier(activePartner(partnerService.supplier(request.partnerId())));
            order.setCustomer(null);
        } else {
            order.setCustomer(activePartner(partnerService.customer(request.partnerId())));
            order.setSupplier(null);
        }

        WarehouseRef warehouse = inventoryClient.warehouses().stream()
                .filter(w -> w.id().equals(request.warehouseId()) && w.active())
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Entrepôt introuvable ou désactivé"));
        order.setWarehouseId(warehouse.id());
        order.setWarehouseName(warehouse.name());

        order.setOrderDate(request.orderDate() == null ? LocalDate.now(ZoneOffset.UTC) : request.orderDate());
        order.setExpectedDate(request.expectedDate());
        order.setTaxRate(request.taxRate());
        order.setNotes(request.notes());

        // SKU et nom viennent d'inventory-service, pas du client : l'historique
        // de la commande reflète toujours le catalogue au moment de la saisie.
        Map<Long, ProductRef> products = inventoryClient.products().stream()
                .collect(Collectors.toMap(ProductRef::id, Function.identity()));
        order.getLines().clear();
        BigDecimal totalHt = BigDecimal.ZERO;
        for (OrderLineRequest lineRequest : request.lines()) {
            ProductRef product = products.get(lineRequest.productId());
            if (product == null) {
                throw new IllegalArgumentException("Produit introuvable ou archivé: " + lineRequest.productId());
            }
            OrderLine line = new OrderLine();
            line.setOrder(order);
            line.setProductId(product.id());
            line.setSku(product.sku());
            line.setProductName(product.name());
            line.setQuantity(lineRequest.quantity());
            line.setUnitPrice(lineRequest.unitPrice().setScale(2, RoundingMode.HALF_UP));
            line.setLineTotal(line.getUnitPrice().multiply(BigDecimal.valueOf(line.getQuantity())));
            order.getLines().add(line);
            totalHt = totalHt.add(line.getLineTotal());
        }
        BigDecimal tax = totalHt.multiply(request.taxRate()).divide(HUNDRED, 2, RoundingMode.HALF_UP);
        order.setTotalHt(totalHt);
        order.setTotalTax(tax);
        order.setTotalTtc(totalHt.add(tax));
    }

    private String nextNumber(OrderType type) {
        long seq = type == OrderType.PURCHASE ? orderRepository.nextPurchaseNumber() : orderRepository.nextSalesNumber();
        return "%s-%d-%05d".formatted(type == OrderType.PURCHASE ? "BA" : "BV", Year.now(ZoneOffset.UTC).getValue(), seq);
    }

    private static <T extends Partner> T activePartner(T partner) {
        if (!partner.isActive()) {
            throw new ConflictException(partner.getName() + " est désactivé");
        }
        return partner;
    }

    private static void requireStatus(PurchaseOrder order, OrderStatus expected, String message) {
        if (order.getStatus() != expected) {
            throw new ConflictException(message);
        }
    }

    private PurchaseOrder find(Long id) {
        return orderRepository.findWithLinesById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Commande introuvable: " + id));
    }

    private static OrderSummary toSummary(PurchaseOrder o) {
        Partner partner = o.getPartner();
        return new OrderSummary(o.getId(), o.getOrderNumber(), o.getType(), o.getStatus(), partner.getId(),
                partner.getName(), o.getWarehouseId(), o.getWarehouseName(), o.getOrderDate(), o.getExpectedDate(),
                o.getTotalHt(), o.getTotalTtc(), o.getCreatedBy(), o.getCreatedAt());
    }

    private static OrderResponse toResponse(PurchaseOrder o) {
        Partner partner = o.getPartner();
        List<OrderLineResponse> lines = o.getLines().stream()
                .map(l -> new OrderLineResponse(l.getId(), l.getProductId(), l.getSku(), l.getProductName(),
                        l.getQuantity(), l.getUnitPrice(), l.getLineTotal()))
                .toList();
        return new OrderResponse(o.getId(), o.getOrderNumber(), o.getType(), o.getStatus(), partner.getId(),
                partner.getName(), o.getWarehouseId(), o.getWarehouseName(), o.getOrderDate(), o.getExpectedDate(),
                o.getTaxRate(), o.getTotalHt(), o.getTotalTax(), o.getTotalTtc(), o.getNotes(), o.getCreatedBy(),
                o.getCompletedBy(), o.getConfirmedAt(), o.getCompletedAt(), o.getCancelledAt(), o.getCreatedAt(), lines);
    }
}
