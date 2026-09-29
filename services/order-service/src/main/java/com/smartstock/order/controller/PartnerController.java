package com.smartstock.order.controller;

import com.smartstock.order.dto.PartnerDtos.PartnerRequest;
import com.smartstock.order.dto.PartnerDtos.PartnerResponse;
import com.smartstock.order.service.PartnerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class PartnerController {

    private final PartnerService partnerService;

    @GetMapping("/suppliers")
    public List<PartnerResponse> suppliers() {
        return partnerService.suppliers();
    }

    @PostMapping("/suppliers")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<PartnerResponse> createSupplier(@Valid @RequestBody PartnerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(partnerService.createSupplier(request));
    }

    @PutMapping("/suppliers/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public PartnerResponse updateSupplier(@PathVariable Long id, @Valid @RequestBody PartnerRequest request) {
        return partnerService.updateSupplier(id, request);
    }

    @DeleteMapping("/suppliers/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<Void> deleteSupplier(@PathVariable Long id) {
        partnerService.deleteSupplier(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/customers")
    public List<PartnerResponse> customers() {
        return partnerService.customers();
    }

    @PostMapping("/customers")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<PartnerResponse> createCustomer(@Valid @RequestBody PartnerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(partnerService.createCustomer(request));
    }

    @PutMapping("/customers/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public PartnerResponse updateCustomer(@PathVariable Long id, @Valid @RequestBody PartnerRequest request) {
        return partnerService.updateCustomer(id, request);
    }

    @DeleteMapping("/customers/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN', 'GESTIONNAIRE')")
    public ResponseEntity<Void> deleteCustomer(@PathVariable Long id) {
        partnerService.deleteCustomer(id);
        return ResponseEntity.noContent().build();
    }
}
