package com.smartstock.order.service;

import com.smartstock.order.dto.PartnerDtos.PartnerRequest;
import com.smartstock.order.dto.PartnerDtos.PartnerResponse;
import com.smartstock.order.entity.Customer;
import com.smartstock.order.entity.Partner;
import com.smartstock.order.entity.Supplier;
import com.smartstock.order.exception.ConflictException;
import com.smartstock.order.exception.ResourceNotFoundException;
import com.smartstock.order.repository.CustomerRepository;
import com.smartstock.order.repository.OrderRepository;
import com.smartstock.order.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PartnerService {

    private final SupplierRepository supplierRepository;
    private final CustomerRepository customerRepository;
    private final OrderRepository orderRepository;

    // --- Fournisseurs ---

    @Transactional(readOnly = true)
    public List<PartnerResponse> suppliers() {
        Map<Long, Long> counts = toMap(orderRepository.countBySupplier());
        return supplierRepository.findAll(Sort.by("name")).stream()
                .map(s -> toResponse(s, counts.getOrDefault(s.getId(), 0L))).toList();
    }

    @Transactional
    public PartnerResponse createSupplier(PartnerRequest request) {
        Supplier supplier = new Supplier();
        apply(supplier, request);
        return toResponse(supplierRepository.save(supplier), 0);
    }

    @Transactional
    public PartnerResponse updateSupplier(Long id, PartnerRequest request) {
        Supplier supplier = supplier(id);
        apply(supplier, request);
        return toResponse(supplierRepository.save(supplier), 0);
    }

    @Transactional
    public void deleteSupplier(Long id) {
        Supplier supplier = supplier(id);
        if (orderRepository.existsBySupplierId(id)) {
            throw new ConflictException("Fournisseur lié à des commandes — désactivez-le plutôt");
        }
        supplierRepository.delete(supplier);
    }

    public Supplier supplier(Long id) {
        return supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fournisseur introuvable: " + id));
    }

    // --- Clients ---

    @Transactional(readOnly = true)
    public List<PartnerResponse> customers() {
        Map<Long, Long> counts = toMap(orderRepository.countByCustomer());
        return customerRepository.findAll(Sort.by("name")).stream()
                .map(c -> toResponse(c, counts.getOrDefault(c.getId(), 0L))).toList();
    }

    @Transactional
    public PartnerResponse createCustomer(PartnerRequest request) {
        Customer customer = new Customer();
        apply(customer, request);
        return toResponse(customerRepository.save(customer), 0);
    }

    @Transactional
    public PartnerResponse updateCustomer(Long id, PartnerRequest request) {
        Customer customer = customer(id);
        apply(customer, request);
        return toResponse(customerRepository.save(customer), 0);
    }

    @Transactional
    public void deleteCustomer(Long id) {
        Customer customer = customer(id);
        if (orderRepository.existsByCustomerId(id)) {
            throw new ConflictException("Client lié à des commandes — désactivez-le plutôt");
        }
        customerRepository.delete(customer);
    }

    public Customer customer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Client introuvable: " + id));
    }

    private static void apply(Partner partner, PartnerRequest request) {
        partner.setName(request.name().trim());
        partner.setContactName(blankToNull(request.contactName()));
        partner.setEmail(blankToNull(request.email()));
        partner.setPhone(blankToNull(request.phone()));
        partner.setAddress(blankToNull(request.address()));
        partner.setCity(blankToNull(request.city()));
        partner.setTaxId(blankToNull(request.taxId()));
        partner.setNotes(blankToNull(request.notes()));
        partner.setActive(request.active());
    }

    private static Map<Long, Long> toMap(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).longValue()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static PartnerResponse toResponse(Partner p, long orderCount) {
        return new PartnerResponse(p.getId(), p.getName(), p.getContactName(), p.getEmail(), p.getPhone(),
                p.getAddress(), p.getCity(), p.getTaxId(), p.getNotes(), p.isActive(), orderCount, p.getCreatedAt());
    }
}
