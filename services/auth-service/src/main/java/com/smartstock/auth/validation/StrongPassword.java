package com.smartstock.auth.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Mot de passe robuste : 10 à 72 caractères (72 octets = limite de BCrypt,
 * au-delà le reste serait ignoré), avec au moins une minuscule, une
 * majuscule et un chiffre, et sans espace en début/fin.
 */
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = StrongPasswordValidator.class)
public @interface StrongPassword {

    String message() default "10 caractères minimum avec au moins une majuscule, une minuscule et un chiffre";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
