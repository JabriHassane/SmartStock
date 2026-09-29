package com.smartstock.inventory.repository;

import com.smartstock.inventory.entity.StockMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface StockMovementRepository extends JpaRepository<StockMovement, Long>, JpaSpecificationExecutor<StockMovement> {

    @Override
    @EntityGraph(attributePaths = {"product", "warehouse"})
    Page<StockMovement> findAll(Specification<StockMovement> spec, Pageable pageable);

    @EntityGraph(attributePaths = {"product", "warehouse"})
    List<StockMovement> findTop8ByOrderByCreatedAtDescIdDesc();

    boolean existsByWarehouseId(Long warehouseId);

    boolean existsByProductId(Long productId);

    boolean existsByReferenceTypeAndReferenceId(
            com.smartstock.inventory.entity.ReferenceType referenceType, String referenceId);

    long countByCreatedAtGreaterThanEqual(Instant since);

    /**
     * Flux journaliers entrées/sorties (hors transferts, internes au stock
     * global) : [jour, entrées, sorties].
     */
    @Query(value = """
            SELECT CAST(date_trunc('day', created_at) AS date) AS day,
                   COALESCE(SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END), 0) AS qty_in,
                   COALESCE(SUM(CASE WHEN quantity < 0 THEN -quantity ELSE 0 END), 0) AS qty_out
            FROM stock_movements
            WHERE created_at >= :since AND movement_type IN ('IN', 'OUT', 'ADJUSTMENT')
            GROUP BY day ORDER BY day""", nativeQuery = true)
    List<Object[]> dailyFlows(@Param("since") Instant since);

    /** [productId, quantité sortie] — sorties réelles (ventes/consommation) depuis `since`. */
    @Query("""
            SELECT m.product.id, SUM(-m.quantity) FROM StockMovement m
            WHERE m.type = com.smartstock.inventory.entity.MovementType.OUT AND m.createdAt >= :since
            GROUP BY m.product.id""")
    List<Object[]> outflowSince(@Param("since") Instant since);
}
