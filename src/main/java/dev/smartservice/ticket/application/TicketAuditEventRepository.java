package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.TicketAuditEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketAuditEventRepository extends JpaRepository<TicketAuditEvent, Long> {
    Page<TicketAuditEvent> findByTicketId(long ticketId, Pageable pageable);
}
