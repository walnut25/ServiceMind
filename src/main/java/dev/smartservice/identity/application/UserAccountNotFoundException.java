package dev.smartservice.identity.application;

public class UserAccountNotFoundException extends RuntimeException {

    public UserAccountNotFoundException(long id) {
        super("User account " + id + " was not found");
    }
}
