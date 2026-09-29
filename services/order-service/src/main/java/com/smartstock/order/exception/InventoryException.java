package com.smartstock.order.exception;

import lombok.Getter;

@Getter
public class InventoryException extends RuntimeException {

    private final int status;

    public InventoryException(int status, String message) {
        super(message);
        this.status = status;
    }
}
