package dev.smartservice.ticket.application;

import dev.smartservice.identity.application.UserAccountDirectory;
import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketAuditEvent;
import dev.smartservice.ticket.domain.TicketAuditEventType;
import dev.smartservice.ticket.domain.TicketComment;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TicketServiceTest {

    private TicketRepository ticketRepository;
    private TicketCommentRepository commentRepository;
    private TicketAuditEventRepository auditRepository;
    private UserAccountDirectory userAccountDirectory;
    private TicketService service;

    @BeforeEach
    void setUp() {
        ticketRepository = mock(TicketRepository.class);
        commentRepository = mock(TicketCommentRepository.class);
        auditRepository = mock(TicketAuditEventRepository.class);
        userAccountDirectory = mock(UserAccountDirectory.class);
        service = new TicketService(ticketRepository, commentRepository, auditRepository, userAccountDirectory);
    }

    @Test
    void recordsActorAndStatusChangeInAuditEvent() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, "requester-one");
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
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, "requester-one");
        when(ticketRepository.findById(42L)).thenReturn(Optional.of(ticket));
        when(commentRepository.save(org.mockito.ArgumentMatchers.any(TicketComment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        TicketComment comment = service.addComment(42L, "Checking gateway logs", "agent-one", true);

        assertThat(comment.getTicketId()).isEqualTo(42L);
        assertThat(comment.getAuthorUsername()).isEqualTo("agent-one");
        assertThat(comment.getContent()).isEqualTo("Checking gateway logs");
        ArgumentCaptor<TicketAuditEvent> event = ArgumentCaptor.forClass(TicketAuditEvent.class);
        verify(auditRepository).save(event.capture());
        assertThat(event.getValue().getEventType()).isEqualTo(TicketAuditEventType.COMMENT_ADDED);
    }

    @Test
    void recordsAuthenticatedUserAsTicketRequester() {
        when(ticketRepository.save(org.mockito.ArgumentMatchers.any(Ticket.class)))
                .thenAnswer(invocation -> {
                    Ticket saved = invocation.getArgument(0);
                    ReflectionTestUtils.setField(saved, "id", 42L);
                    return saved;
                });

        Ticket ticket = service.create("VPN unavailable", "Cannot connect", TicketPriority.P1, "requester-one");

        assertThat(ticket.getRequesterUsername()).isEqualTo("requester-one");
    }

    @Test
    void hidesAnotherRequestersTicket() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, "requester-one");
        when(ticketRepository.findById(42L)).thenReturn(Optional.of(ticket));

        assertThatThrownBy(() -> service.getVisible(42L, "requester-two", false))
                .isInstanceOf(TicketNotFoundException.class);
    }

    @Test
    void scopesRequesterTicketSearchToAuthenticatedUser() {
        PageRequest pageable = PageRequest.of(0, 20);

        service.list(TicketStatus.OPEN, TicketPriority.P1, null, "requester-one", false, pageable);

        verify(ticketRepository).search(TicketStatus.OPEN, TicketPriority.P1, null, "requester-one", pageable);
    }

    @Test
    void assignsEligibleAgentAndRecordsAuditEvent() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, "requester-one");
        when(ticketRepository.findById(42L)).thenReturn(Optional.of(ticket));
        when(userAccountDirectory.canBeAssignedTickets("agent-one")).thenReturn(true);

        Ticket assigned = service.assign(42L, " agent-one ", "admin");

        assertThat(assigned.getAssigneeUsername()).isEqualTo("agent-one");
        ArgumentCaptor<TicketAuditEvent> event = ArgumentCaptor.forClass(TicketAuditEvent.class);
        verify(auditRepository).save(event.capture());
        assertThat(event.getValue().getEventType()).isEqualTo(TicketAuditEventType.ASSIGNEE_CHANGED);
        assertThat(event.getValue().getDetails()).isEqualTo("Assignee changed from unassigned to agent-one");
    }

    @Test
    void rejectsUnknownOrIneligibleAssignee() {
        when(userAccountDirectory.canBeAssignedTickets("requester-one")).thenReturn(false);

        assertThatThrownBy(() -> service.assign(42L, "requester-one", "admin"))
                .isInstanceOf(InvalidTicketAssigneeException.class);
    }
}
