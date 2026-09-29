package com.smartstock.auth.exception;

/** Opération refusée par une règle métier (ex. supprimer le dernier SuperAdmin). */
public class BusinessRuleException extends RuntimeException {

    public BusinessRuleException(String message) {
        super(message);
    }
}
