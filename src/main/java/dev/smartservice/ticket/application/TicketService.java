package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketAuditEvent;
import dev.smartservice.ticket.domain.TicketAuditEventType;
import dev.smartservice.ticket.domain.TicketComment;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TicketService {

    private final TicketRepository repository;
    private final TicketCommentRepository commentRepository;
    private final TicketAuditEventRepository auditRepository;

    public TicketService(TicketRepository repository, TicketCommentRepository commentRepository,
                         TicketAuditEventRepository auditRepository) {
        this.repository = repository;
        this.commentRepository = commentRepository;
        this.auditRepository = auditRepository;
    }

    public Ticket create(String title, String description, TicketPriority priority, String actorUsername) {
        Ticket ticket = repository.save(new Ticket(title, description, priority));
        auditRepository.save(new TicketAuditEvent(ticket.getId(), TicketAuditEventType.TICKET_CREATED,
                actorUsername, "Ticket created with priority " + priority));
        return ticket;
    }

    @Transactional(readOnly = true)
    public Ticket get(long id) {
        return repository.findById(id).orElseThrow(() -> new TicketNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Page<Ticket> list(Pageable pageable) {
        return repository.findAll(pageable);
    }

    public Ticket transition(long id, TicketStatus status, String actorUsername) {
        Ticket ticket = get(id);
        TicketStatus previousStatus = ticket.getStatus();
        ticket.transitionTo(status);
        auditRepository.save(new TicketAuditEvent(id, TicketAuditEventType.STATUS_CHANGED, actorUsername,
                "Status changed from " + previousStatus + " to " + status));
        return ticket;
    }

    public TicketComment addComment(long ticketId, String content, String actorUsername) {
        get(ticketId);
        TicketComment comment = commentRepository.save(new TicketComment(ticketId, actorUsername, content));
        auditRepository.save(new TicketAuditEvent(ticketId, TicketAuditEventType.COMMENT_ADDED,
                actorUsername, "Comment added"));
        return comment;
    }

    @Transactional(readOnly = true)
    public Page<TicketComment> listComments(long ticketId, Pageable pageable) {
        get(ticketId);
        return commentRepository.findByTicketId(ticketId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<TicketAuditEvent> listAuditEvents(long ticketId, Pageable pageable) {
        get(ticketId);
        return auditRepository.findByTicketId(ticketId, pageable);
    }
}
