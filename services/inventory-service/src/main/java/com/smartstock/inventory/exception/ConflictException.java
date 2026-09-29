package com.smartstock.inventory.exception;

/** Doublon ou opération incompatible avec l'état actuel (ex. supprimer une catégorie utilisée). */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
