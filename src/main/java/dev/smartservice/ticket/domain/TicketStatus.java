package dev.smartservice.ticket.domain;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum TicketStatus {
    OPEN,
    IN_PROGRESS,
    RESOLVED,
    CLOSED;

    private static final Map<TicketStatus, Set<TicketStatus>> TRANSITIONS = Map.of(
            OPEN, EnumSet.of(IN_PROGRESS, CLOSED),
            IN_PROGRESS, EnumSet.of(RESOLVED, CLOSED),
            RESOLVED, EnumSet.of(IN_PROGRESS, CLOSED),
            CLOSED, EnumSet.noneOf(TicketStatus.class)
    );

    public boolean canTransitionTo(TicketStatus target) {
        return TRANSITIONS.get(this).contains(target);
    }
}
