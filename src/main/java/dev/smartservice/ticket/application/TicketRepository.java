package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TicketRepository extends JpaRepository<Ticket, Long> {

    @Query("""
            SELECT ticket FROM Ticket ticket
            WHERE (:status IS NULL OR ticket.status = :status)
              AND (:priority IS NULL OR ticket.priority = :priority)
              AND (:assignee IS NULL OR LOWER(ticket.assigneeUsername) = LOWER(:assignee))
              AND (:requester IS NULL OR LOWER(ticket.requesterUsername) = LOWER(:requester))
            """)
    Page<Ticket> search(@Param("status") TicketStatus status,
                        @Param("priority") TicketPriority priority,
                        @Param("assignee") String assignee,
                        @Param("requester") String requester,
                        Pageable pageable);
}
