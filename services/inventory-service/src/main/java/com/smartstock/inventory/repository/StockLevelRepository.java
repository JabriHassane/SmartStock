package com.smartstock.inventory.repository;

import com.smartstock.inventory.entity.StockLevel;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface StockLevelRepository extends JpaRepository<StockLevel, Long>, JpaSpecificationExecutor<StockLevel> {

    @Override
    @EntityGraph(attributePaths = {"product", "product.category", "warehouse"})
    Page<StockLevel> findAll(Specification<StockLevel> spec, Pageable pageable);

    /** Verrou pessimiste : deux mouvements simultanés sur la même ligne sont sérialisés. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM StockLevel s WHERE s.product.id = :productId AND s.warehouse.id = :warehouseId")
    Optional<StockLevel> findForUpdate(@Param("productId") Long productId, @Param("warehouseId") Long warehouseId);

    @EntityGraph(attributePaths = "warehouse")
    List<StockLevel> findByProductIdOrderByWarehouseName(Long productId);

    boolean existsByWarehouseIdAndQuantityOnHandGreaterThan(Long warehouseId, int quantity);

    /** [productId, quantité totale] pour les produits donnés. */
    @Query("SELECT s.product.id, SUM(s.quantityOnHand) FROM StockLevel s WHERE s.product.id IN :ids GROUP BY s.product.id")
    List<Object[]> totalsForProducts(@Param("ids") Collection<Long> ids);

    /** [productId, quantité totale] pour tous les produits actifs, 0 si aucun stock. */
    @Query("""
            SELECT p.id, COALESCE(SUM(s.quantityOnHand), 0)
            FROM Product p LEFT JOIN StockLevel s ON s.product = p
            WHERE p.active = true
            GROUP BY p.id""")
    List<Object[]> totalsForActiveProducts();

    @Query("SELECT COALESCE(SUM(s.quantityOnHand), 0) FROM StockLevel s WHERE s.product.active = true")
    long totalUnits();

    @Query("SELECT COALESCE(SUM(s.quantityOnHand * s.product.costPrice), 0) FROM StockLevel s WHERE s.product.active = true")
    BigDecimal totalCostValue();

    @Query("SELECT COALESCE(SUM(s.quantityOnHand * s.product.unitPrice), 0) FROM StockLevel s WHERE s.product.active = true")
    BigDecimal totalSaleValue();

    /** [warehouseId, nb produits en stock, unités, valeur au coût]. */
    @Query("""
            SELECT s.warehouse.id, SUM(CASE WHEN s.quantityOnHand > 0 THEN 1 ELSE 0 END),
                   SUM(s.quantityOnHand), SUM(s.quantityOnHand * s.product.costPrice)
            FROM StockLevel s GROUP BY s.warehouse.id""")
    List<Object[]> warehouseTotals();

    /** [categoryId, nom, couleur, valeur au coût, unités, nb produits] — catégorie null = "Sans catégorie". */
    @Query("""
            SELECT c.id, c.name, c.color, SUM(s.quantityOnHand * p.costPrice), SUM(s.quantityOnHand), COUNT(DISTINCT p.id)
            FROM StockLevel s JOIN s.product p LEFT JOIN p.category c
            WHERE p.active = true
            GROUP BY c.id, c.name, c.color
            ORDER BY SUM(s.quantityOnHand * p.costPrice) DESC""")
    List<Object[]> categoryTotals();
}
