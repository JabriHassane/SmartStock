package com.smartstock.inventory.controller;

import com.smartstock.inventory.dto.CatalogDtos.ProductDetailResponse;
import com.smartstock.inventory.dto.CatalogDtos.ProductOption;
import com.smartstock.inventory.dto.CatalogDtos.ProductRequest;
import com.smartstock.inventory.dto.CatalogDtos.ProductResponse;
import com.smartstock.inventory.dto.CatalogDtos.StockStatus;
import com.smartstock.inventory.dto.PageResponse;
import com.smartstock.inventory.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping
    public PageResponse<ProductResponse> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) StockStatus status,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String direction) {
        return productService.search(search, categoryId, status, active, page, size, sort, direction);
    }

    @GetMapping("/options")
    public List<ProductOption> options() {
        return productService.options();
    }

    @GetMapping("/{id}")
    public ProductDetailResponse get(@PathVariable Long id) {
        return productService.get(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ProductResponse update(@PathVariable Long id, @Valid @RequestBody ProductRequest request) {
        return productService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        productService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
