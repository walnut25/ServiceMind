package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketAuditEvent;
import dev.smartservice.ticket.domain.TicketAuditEventType;
import dev.smartservice.ticket.domain.TicketComment;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TicketServiceTest {

    private TicketRepository ticketRepository;
    private TicketCommentRepository commentRepository;
    private TicketAuditEventRepository auditRepository;
    private TicketService service;

    @BeforeEach
    void setUp() {
        ticketRepository = mock(TicketRepository.class);
        commentRepository = mock(TicketCommentRepository.class);
        auditRepository = mock(TicketAuditEventRepository.class);
        service = new TicketService(ticketRepository, commentRepository, auditRepository);
    }

    @Test
    void recordsActorAndStatusChangeInAuditEvent() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1);
        when(ticketRepository.findById(42L)).thenReturn(Optional.of(ticket));

        service.transition(42L, TicketStatus.IN_PROGRESS, "agent-one");

        ArgumentCaptor<TicketAuditEvent> event = ArgumentCaptor.forClass(TicketAuditEvent.class);
        verify(auditRepository).save(event.capture());
        assertThat(event.getValue().getEventType()).isEqualTo(TicketAuditEventType.STATUS_CHANGED);
        assertThat(event.getValue().getActorUsername()).isEqualTo("agent-one");
        assertThat(event.getValue().getDetails()).isEqualTo("Status changed from OPEN to IN_PROGRESS");
    }

    @Test
    void recordsAuthenticatedUserAsCommentAuthor() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1);
        when(ticketRepository.findById(42L)).thenReturn(Optional.of(ticket));
        when(commentRepository.save(org.mockito.ArgumentMatchers.any(TicketComment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TicketComment comment = service.addComment(42L, "Checking gateway logs", "agent-one");

        assertThat(comment.getTicketId()).isEqualTo(42L);
        assertThat(comment.getAuthorUsername()).isEqualTo("agent-one");
        assertThat(comment.getContent()).isEqualTo("Checking gateway logs");
        ArgumentCaptor<TicketAuditEvent> event = ArgumentCaptor.forClass(TicketAuditEvent.class);
        verify(auditRepository).save(event.capture());
        assertThat(event.getValue().getEventType()).isEqualTo(TicketAuditEventType.COMMENT_ADDED);
    }
}
