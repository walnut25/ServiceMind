package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    @Query("""
            SELECT ticket FROM Ticket ticket
            WHERE (:status IS NULL OR ticket.status = :status)
              AND (:priority IS NULL OR ticket.priority = :priority)
              AND (:assignee IS NULL OR LOWER(ticket.assigneeUsername) = LOWER(:assignee))
              AND (:requester IS NULL OR LOWER(ticket.requesterUsername) = LOWER(:requester))
              AND (:slaBreached IS NULL
                   OR (:slaBreached = TRUE AND
                       ((ticket.resolvedAt IS NULL AND ticket.dueAt < :now)
                        OR ticket.resolvedAt > ticket.dueAt))
                   OR (:slaBreached = FALSE AND
                       ((ticket.resolvedAt IS NULL AND ticket.dueAt >= :now)
                        OR ticket.resolvedAt <= ticket.dueAt)))
            """)
    Page<Ticket> search(@Param("status") TicketStatus status,
                        @Param("priority") TicketPriority priority,
                        @Param("assignee") String assignee,
                        @Param("requester") String requester,
                        @Param("slaBreached") Boolean slaBreached,
                        @Param("now") Instant now,
                        Pageable pageable);

    long countByStatus(TicketStatus status);

    long countByPriority(TicketPriority priority);

    long countByStatusIn(Collection<TicketStatus> statuses);

    @Query("""
            SELECT COUNT(ticket) FROM Ticket ticket
            WHERE ticket.assigneeUsername IS NULL
              AND ticket.status IN :statuses
            """)
    long countUnassignedInStatuses(@Param("statuses") Collection<TicketStatus> statuses);

    @Query("""
            SELECT COUNT(ticket) FROM Ticket ticket
            WHERE ticket.resolvedAt IS NULL
              AND ticket.dueAt < :now
            """)
    long countSlaBreached(@Param("now") Instant now);

    @Query("""
            SELECT COUNT(ticket) FROM Ticket ticket
            WHERE ticket.resolvedAt IS NULL
              AND ticket.dueAt >= :now
              AND ticket.dueAt <= :cutoff
            """)
    long countDueSoon(@Param("now") Instant now, @Param("cutoff") Instant cutoff);
}
