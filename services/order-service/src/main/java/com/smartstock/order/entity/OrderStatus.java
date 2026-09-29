package com.smartstock.order.entity;

/** DRAFT → CONFIRMED → COMPLETED (reçue/expédiée) ; DRAFT/CONFIRMED → CANCELLED. */
public enum OrderStatus {
    DRAFT,
    CONFIRMED,
    COMPLETED,
    CANCELLED
}
