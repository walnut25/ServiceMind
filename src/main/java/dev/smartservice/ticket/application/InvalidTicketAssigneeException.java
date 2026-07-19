package dev.smartservice.ticket.application;

public class InvalidTicketAssigneeException extends RuntimeException {

    public InvalidTicketAssigneeException(String username) {
        super("User '" + username + "' does not exist or cannot be assigned tickets");
    }
}
