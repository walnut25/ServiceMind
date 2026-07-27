package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;

import java.time.Instant;
import java.util.Map;

public record TicketMetrics(
        Instant generatedAt,
        long total,
        long active,
        long unassignedActive,
        long breached,
        long dueSoon,
        Map<TicketStatus, Long> byStatus,
        Map<TicketPriority, Long> byPriority) {
}
