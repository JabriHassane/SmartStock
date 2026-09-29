package com.smartstock.auth.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {

    private static final int MIN_LENGTH = 10;
    private static final int MAX_BYTES = 72;

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return false;
        }
        return value.length() >= MIN_LENGTH
                && value.getBytes(StandardCharsets.UTF_8).length <= MAX_BYTES
                && value.equals(value.strip())
                && value.chars().anyMatch(Character::isLowerCase)
                && value.chars().anyMatch(Character::isUpperCase)
                && value.chars().anyMatch(Character::isDigit);
    }
}
