package dev.smartservice.ticket.api;

import dev.smartservice.common.config.WebConfiguration;
import dev.smartservice.identity.application.DatabaseUserDetailsService;
import dev.smartservice.identity.config.SecurityConfiguration;
import dev.smartservice.ticket.application.TicketService;
import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketPriority;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

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
        when(service.list(any(), any(), any(), anyString(), anyBoolean(), any())).thenReturn(Page.empty());

        mockMvc.perform(get("/api/v1/tickets?status=OPEN&priority=P1")
                        .with(jwt().jwt(token -> token.subject("requester-one"))
                                .authorities(new SimpleGrantedAuthority("ROLE_REQUESTER"))))
                .andExpect(status().isOk());

        verify(service).list(eq(dev.smartservice.ticket.domain.TicketStatus.OPEN), eq(TicketPriority.P1),
                eq(null), eq("requester-one"), eq(false), any());
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

    private Ticket ticket(long id, String requester) {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, requester);
        ReflectionTestUtils.setField(ticket, "id", id);
        return ticket;
    }
}
