package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.TicketComment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketCommentRepository extends JpaRepository<TicketComment, Long> {
    Page<TicketComment> findByTicketId(long ticketId, Pageable pageable);
}
