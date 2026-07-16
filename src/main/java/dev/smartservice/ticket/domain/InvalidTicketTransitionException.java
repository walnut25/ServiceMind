package dev.smartservice.ticket.domain;

public class InvalidTicketTransitionException extends RuntimeException {

    public InvalidTicketTransitionException(TicketStatus source, TicketStatus target) {
        super("Ticket cannot transition from %s to %s".formatted(source, target));
    }
}
