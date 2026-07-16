package dev.smartservice.ticket.application;

public class TicketNotFoundException extends RuntimeException {

    public TicketNotFoundException(long id) {
        super("Ticket %d was not found".formatted(id));
    }
}
