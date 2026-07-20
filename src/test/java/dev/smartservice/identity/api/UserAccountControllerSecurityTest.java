package dev.smartservice.identity.api;

import dev.smartservice.common.config.WebConfiguration;
import dev.smartservice.identity.application.DatabaseUserDetailsService;
import dev.smartservice.identity.application.UserAccountService;
import dev.smartservice.identity.config.SecurityConfiguration;
import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Set;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserAccountController.class)
@Import({SecurityConfiguration.class, WebConfiguration.class})
class UserAccountControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserAccountService service;

    @MockitoBean
    private DatabaseUserDetailsService userDetailsService;

    @Test
    void rejectsUnauthenticatedUserManagementRequests() throws Exception {
        mockMvc.perform(get("/api/v1/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void forbidsRequesterFromCreatingUsers() throws Exception {
        mockMvc.perform(post("/api/v1/users")
                        .with(jwt().jwt(token -> token.subject("requester-one"))
                                .authorities(new SimpleGrantedAuthority("ROLE_REQUESTER")))
                        .contentType("application/json")
                        .content(createUserJson()))
                .andExpect(status().isForbidden());
    }

    @Test
    void allowsAdministratorToCreateAgent() throws Exception {
        UserAccount agent = new UserAccount("agent-one", "encoded-password", Set.of(UserRole.AGENT));
        ReflectionTestUtils.setField(agent, "id", 42L);
        when(service.create("agent-one", "AgentPass123!", Set.of(UserRole.AGENT))).thenReturn(agent);

        mockMvc.perform(post("/api/v1/users")
                        .with(jwt().jwt(token -> token.subject("admin"))
                                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
                        .contentType("application/json")
                        .content(createUserJson()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(42))
                .andExpect(jsonPath("$.username").value("agent-one"))
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.roles[0]").value("AGENT"));
    }

    private String createUserJson() {
        return """
                {
                  "username": "agent-one",
                  "password": "AgentPass123!",
                  "roles": ["AGENT"]
                }
                """;
    }
}
