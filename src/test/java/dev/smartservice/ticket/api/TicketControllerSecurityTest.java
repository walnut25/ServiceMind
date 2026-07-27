package dev.smartservice.ticket.api;

import dev.smartservice.common.config.WebConfiguration;
import dev.smartservice.identity.application.DatabaseUserDetailsService;
import dev.smartservice.identity.config.SecurityConfiguration;
import dev.smartservice.ticket.application.TicketMetrics;
import dev.smartservice.ticket.application.TicketService;
import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TicketController.class)
@Import({SecurityConfiguration.class, WebConfiguration.class})
class TicketControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private TicketService service;

    @MockitoBean
    private DatabaseUserDetailsService userDetailsService;

    @Test
    void rejectsUnauthenticatedTicketRequests() throws Exception {
        mockMvc.perform(get("/api/v1/tickets"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void scopesRequesterTicketListToAuthenticatedUsername() throws Exception {
        when(service.list(any(), any(), any(), any(), anyString(), anyBoolean(), any())).thenReturn(Page.empty());

        mockMvc.perform(get("/api/v1/tickets?status=OPEN&priority=P1&slaBreached=true")
                        .with(jwt().jwt(token -> token.subject("requester-one"))
                                .authorities(new SimpleGrantedAuthority("ROLE_REQUESTER"))))
                .andExpect(status().isOk());

        verify(service).list(eq(TicketStatus.OPEN), eq(TicketPriority.P1),
                eq(null), eq(true), eq("requester-one"), eq(false), any());
    }

    @Test
    void forbidsRequesterFromChangingTicketStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/tickets/42/status")
                        .with(jwt().jwt(token -> token.subject("requester-one"))
                                .authorities(new SimpleGrantedAuthority("ROLE_REQUESTER")))
                        .contentType("application/json")
                        .content("""
                                {"status":"IN_PROGRESS"}
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAgentToAssignTicket() throws Exception {
        Ticket ticket = ticket(42L, "requester-one");
        ticket.assignTo("agent-two");
        when(service.assign(42L, "agent-two", "agent-one")).thenReturn(ticket);

        mockMvc.perform(patch("/api/v1/tickets/42/assignee")
                        .with(jwt().jwt(token -> token.subject("agent-one"))
                                .authorities(new SimpleGrantedAuthority("ROLE_AGENT")))
                        .contentType("application/json")
                        .content("""
                                {"username":"agent-two"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requesterUsername").value("requester-one"))
                .andExpect(jsonPath("$.assigneeUsername").value("agent-two"));
    }

    @Test
    void allowsSupportStaffToViewMetrics() throws Exception {
        when(service.metrics()).thenReturn(new TicketMetrics(
                Instant.parse("2026-07-28T08:00:00Z"),
                12, 7, 3, 2, 1,
                Map.of(TicketStatus.OPEN, 5L),
                Map.of(TicketPriority.P1, 4L)));

        mockMvc.perform(get("/api/v1/tickets/metrics")
                        .with(jwt().jwt(token -> token.subject("agent-one"))
                                .authorities(new SimpleGrantedAuthority("ROLE_AGENT"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(12))
                .andExpect(jsonPath("$.active").value(7))
                .andExpect(jsonPath("$.breached").value(2))
                .andExpect(jsonPath("$.byStatus.OPEN").value(5));
    }

    @Test
    void forbidsRequesterFromViewingTeamMetrics() throws Exception {
        mockMvc.perform(get("/api/v1/tickets/metrics")
                        .with(jwt().jwt(token -> token.subject("requester-one"))
                                .authorities(new SimpleGrantedAuthority("ROLE_REQUESTER"))))
                .andExpect(status().isForbidden());
    }

    private Ticket ticket(long id, String requester) {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, requester);
        ReflectionTestUtils.setField(ticket, "id", id);
        return ticket;
    }
}
