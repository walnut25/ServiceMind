package dev.smartservice.ticket.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TicketTest {

    @Test
    void followsAllowedWorkflow() {
        Ticket ticket = new Ticket("VPN unavailable", "The whole team cannot connect", TicketPriority.P1,
                "requester-one");

        ticket.transitionTo(TicketStatus.IN_PROGRESS);
        ticket.transitionTo(TicketStatus.RESOLVED);
        ticket.transitionTo(TicketStatus.CLOSED);

        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.CLOSED);
    }

    @Test
    void rejectsSkippingFromOpenToResolved() {
        Ticket ticket = new Ticket("VPN unavailable", "The whole team cannot connect", TicketPriority.P1,
                "requester-one");

        assertThatThrownBy(() -> ticket.transitionTo(TicketStatus.RESOLVED))
                .isInstanceOf(InvalidTicketTransitionException.class)
                .hasMessageContaining("OPEN")
                .hasMessageContaining("RESOLVED");
    }

    @Test
    void recordsRequesterAndAssignee() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P2, "Requester-One");

        ticket.assignTo("agent-one");

        assertThat(ticket.isRequestedBy("requester-one")).isTrue();
        assertThat(ticket.getRequesterUsername()).isEqualTo("Requester-One");
        assertThat(ticket.getAssigneeUsername()).isEqualTo("agent-one");
    }
}
