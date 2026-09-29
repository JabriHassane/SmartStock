package com.smartstock.order.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class PartnerDtos {

    private PartnerDtos() {
    }

    public record PartnerRequest(
            @NotBlank @Size(max = 160) String name,
            @Size(max = 120) String contactName,
            @Email @Size(max = 255) String email,
            @Size(max = 40) String phone,
            @Size(max = 255) String address,
            @Size(max = 120) String city,
            @Size(max = 40) String taxId,
            @Size(max = 2000) String notes,
            boolean active) {
    }

    public record PartnerResponse(
            Long id,
            String name,
            String contactName,
            String email,
            String phone,
            String address,
            String city,
            String taxId,
            String notes,
            boolean active,
            long orderCount,
            Instant createdAt) {
    }
}
