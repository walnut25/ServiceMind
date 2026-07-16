package dev.smartservice.ticket.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TicketTest {

    @Test
    void followsAllowedWorkflow() {
        Ticket ticket = new Ticket("VPN unavailable", "The whole team cannot connect", TicketPriority.P1);

        ticket.transitionTo(TicketStatus.IN_PROGRESS);
        ticket.transitionTo(TicketStatus.RESOLVED);
        ticket.transitionTo(TicketStatus.CLOSED);

        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.CLOSED);
    }

    @Test
    void rejectsSkippingFromOpenToResolved() {
        Ticket ticket = new Ticket("VPN unavailable", "The whole team cannot connect", TicketPriority.P1);

        assertThatThrownBy(() -> ticket.transitionTo(TicketStatus.RESOLVED))
                .isInstanceOf(InvalidTicketTransitionException.class)
                .hasMessageContaining("OPEN")
                .hasMessageContaining("RESOLVED");
    }
}
