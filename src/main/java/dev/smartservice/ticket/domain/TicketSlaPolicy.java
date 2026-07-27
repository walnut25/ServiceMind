package dev.smartservice.ticket.domain;

import java.time.Duration;
import java.time.Instant;

public final class TicketSlaPolicy {

    private TicketSlaPolicy() {
    }

    public static Duration targetFor(TicketPriority priority) {
        return switch (priority) {
            case P1 -> Duration.ofHours(4);
            case P2 -> Duration.ofHours(8);
            case P3 -> Duration.ofHours(24);
            case P4 -> Duration.ofHours(72);
        };
    }

    public static Instant deadlineFor(TicketPriority priority, Instant createdAt) {
        return createdAt.plus(targetFor(priority));
    }
}
