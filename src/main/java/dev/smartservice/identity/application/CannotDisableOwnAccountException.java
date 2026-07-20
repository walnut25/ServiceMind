package dev.smartservice.identity.application;

public class CannotDisableOwnAccountException extends RuntimeException {

    public CannotDisableOwnAccountException() {
        super("Administrators cannot disable their own account");
    }
}
