package dev.smartservice.ticket.application;

import dev.smartservice.identity.application.UserAccountDirectory;
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
    private final UserAccountDirectory userAccountDirectory;

    public TicketService(TicketRepository repository, TicketCommentRepository commentRepository,
                         TicketAuditEventRepository auditRepository, UserAccountDirectory userAccountDirectory) {
        this.repository = repository;
        this.commentRepository = commentRepository;
        this.auditRepository = auditRepository;
        this.userAccountDirectory = userAccountDirectory;
    }

    public Ticket create(String title, String description, TicketPriority priority, String actorUsername) {
        Ticket ticket = repository.save(new Ticket(title, description, priority, actorUsername));
        auditRepository.save(new TicketAuditEvent(ticket.getId(), TicketAuditEventType.TICKET_CREATED,
                actorUsername, "Ticket created with priority " + priority));
        return ticket;
    }

    @Transactional(readOnly = true)
    public Ticket get(long id) {
        return repository.findById(id).orElseThrow(() -> new TicketNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Ticket getVisible(long id, String username, boolean canManage) {
        Ticket ticket = get(id);
        if (!canManage && !ticket.isRequestedBy(username)) {
            throw new TicketNotFoundException(id);
        }
        return ticket;
    }

    @Transactional(readOnly = true)
    public Page<Ticket> list(TicketStatus status, TicketPriority priority, String assignee,
                             String username, boolean canManage, Pageable pageable) {
        String requester = canManage ? null : username;
        return repository.search(status, priority, normalize(assignee), requester, pageable);
    }

    public Ticket transition(long id, TicketStatus status, String actorUsername) {
        Ticket ticket = get(id);
        TicketStatus previousStatus = ticket.getStatus();
        ticket.transitionTo(status);
        auditRepository.save(new TicketAuditEvent(id, TicketAuditEventType.STATUS_CHANGED, actorUsername,
                "Status changed from " + previousStatus + " to " + status));
        return ticket;
    }

    public Ticket assign(long id, String assigneeUsername, String actorUsername) {
        String assignee = assigneeUsername.strip();
        if (!userAccountDirectory.canBeAssignedTickets(assignee)) {
            throw new InvalidTicketAssigneeException(assignee);
        }
        Ticket ticket = get(id);
        String previousAssignee = ticket.getAssigneeUsername();
        ticket.assignTo(assignee);
        auditRepository.save(new TicketAuditEvent(id, TicketAuditEventType.ASSIGNEE_CHANGED, actorUsername,
                "Assignee changed from " + displayAssignee(previousAssignee) + " to " + assignee));
        return ticket;
    }

    public TicketComment addComment(long ticketId, String content, String actorUsername, boolean canManage) {
        getVisible(ticketId, actorUsername, canManage);
        TicketComment comment = commentRepository.save(new TicketComment(ticketId, actorUsername, content));
        auditRepository.save(new TicketAuditEvent(ticketId, TicketAuditEventType.COMMENT_ADDED,
                actorUsername, "Comment added"));
        return comment;
    }

    @Transactional(readOnly = true)
    public Page<TicketComment> listComments(long ticketId, String username, boolean canManage, Pageable pageable) {
        getVisible(ticketId, username, canManage);
        return commentRepository.findByTicketId(ticketId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<TicketAuditEvent> listAuditEvents(long ticketId, Pageable pageable) {
        get(ticketId);
        return auditRepository.findByTicketId(ticketId, pageable);
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private String displayAssignee(String assignee) {
        return assignee == null ? "unassigned" : assignee;
    }
}
