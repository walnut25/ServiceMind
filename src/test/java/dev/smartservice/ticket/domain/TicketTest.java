package dev.smartservice.ticket.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Duration;
import java.time.Instant;

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

    @ParameterizedTest
    @CsvSource({"P1,4", "P2,8", "P3,24", "P4,72"})
    void calculatesDeadlineFromPriority(TicketPriority priority, long targetHours) {
        Instant createdAt = Instant.parse("2026-07-28T08:00:00Z");

        Ticket ticket = new Ticket("Service unavailable", "Cannot continue work", priority,
                "requester-one", createdAt);

        assertThat(Duration.between(ticket.getCreatedAt(), ticket.getDueAt()))
                .isEqualTo(Duration.ofHours(targetHours));
        assertThat(ticket.slaStatusAt(createdAt.plus(Duration.ofMinutes(30))))
                .isEqualTo(TicketSlaStatus.ON_TRACK);
    }

    @Test
    void recordsWhetherCompletedTicketMetItsSla() {
        Ticket onTime = new Ticket("Printer issue", "Paper jam", TicketPriority.P4,
                "requester-one", Instant.now().minus(Duration.ofHours(1)));
        onTime.transitionTo(TicketStatus.CLOSED);

        Ticket late = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1,
                "requester-one", Instant.now().minus(Duration.ofHours(5)));
        late.transitionTo(TicketStatus.CLOSED);

        assertThat(onTime.slaStatusAt(Instant.now())).isEqualTo(TicketSlaStatus.MET);
        assertThat(late.slaStatusAt(Instant.now())).isEqualTo(TicketSlaStatus.BREACHED);
        assertThat(onTime.getResolvedAt()).isNotNull();
    }

    @Test
    void clearsCompletionTimeWhenResolvedTicketIsReopened() {
        Ticket ticket = new Ticket("VPN unstable", "Connection drops", TicketPriority.P2,
                "requester-one");
        ticket.transitionTo(TicketStatus.IN_PROGRESS);
        ticket.transitionTo(TicketStatus.RESOLVED);

        ticket.transitionTo(TicketStatus.IN_PROGRESS);

        assertThat(ticket.getResolvedAt()).isNull();
        assertThat(ticket.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);
    }
}
