package com.smartstock.order.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Champs communs aux fournisseurs et aux clients (tables séparées, même structure). */
@MappedSuperclass
@Getter
@Setter
public abstract class Partner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(name = "contact_name", length = 120)
    private String contactName;

    private String email;

    @Column(length = 40)
    private String phone;

    private String address;

    @Column(length = 120)
    private String city;

    @Column(name = "tax_id", length = 40)
    private String taxId;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
