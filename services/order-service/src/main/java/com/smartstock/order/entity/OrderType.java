package com.smartstock.order.entity;

public enum OrderType {
    /** Achat fournisseur : la réception fait entrer le stock. */
    PURCHASE,
    /** Vente client : l'expédition fait sortir le stock. */
    SALE
}
