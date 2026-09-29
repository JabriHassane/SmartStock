package com.smartstock.order.repository;

import com.smartstock.order.entity.OrderStatus;
import com.smartstock.order.entity.OrderType;
import com.smartstock.order.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<PurchaseOrder, Long>, JpaSpecificationExecutor<PurchaseOrder> {

    @Override
    @EntityGraph(attributePaths = {"supplier", "customer"})
    Page<PurchaseOrder> findAll(Specification<PurchaseOrder> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"supplier", "customer", "lines"})
    Optional<PurchaseOrder> findWithLinesById(Long id);

    @EntityGraph(attributePaths = {"supplier", "customer"})
    List<PurchaseOrder> findTop6ByOrderByCreatedAtDesc();

    @Query("SELECT o.supplier.id, COUNT(o) FROM PurchaseOrder o WHERE o.supplier IS NOT NULL GROUP BY o.supplier.id")
    List<Object[]> countBySupplier();

    @Query("SELECT o.customer.id, COUNT(o) FROM PurchaseOrder o WHERE o.customer IS NOT NULL GROUP BY o.customer.id")
    List<Object[]> countByCustomer();

    boolean existsBySupplierId(Long supplierId);

    boolean existsByCustomerId(Long customerId);

    long countByTypeAndStatusIn(OrderType type, Collection<OrderStatus> statuses);

    @Query("""
            SELECT COALESCE(SUM(o.totalTtc), 0) FROM PurchaseOrder o
            WHERE o.type = :type AND o.status = com.smartstock.order.entity.OrderStatus.COMPLETED
              AND o.completedAt >= :since""")
    BigDecimal completedTotalSince(@Param("type") OrderType type, @Param("since") Instant since);

    /** [mois (1er jour), type, total TTC] des commandes terminées depuis `since`. */
    @Query(value = """
            SELECT CAST(date_trunc('month', completed_at) AS date) AS month, order_type, SUM(total_ttc)
            FROM orders
            WHERE status = 'COMPLETED' AND completed_at >= :since
            GROUP BY month, order_type ORDER BY month""", nativeQuery = true)
    List<Object[]> monthlyTotals(@Param("since") Instant since);

    @Query(value = "SELECT nextval('purchase_order_number_seq')", nativeQuery = true)
    long nextPurchaseNumber();

    @Query(value = "SELECT nextval('sales_order_number_seq')", nativeQuery = true)
    long nextSalesNumber();
}
