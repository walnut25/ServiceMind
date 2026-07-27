package dev.smartservice.integration;

import dev.smartservice.identity.application.UserAccountRepository;
import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import dev.smartservice.knowledge.application.KnowledgeArticleRepository;
import dev.smartservice.knowledge.domain.KnowledgeArticle;
import dev.smartservice.ticket.application.TicketRepository;
import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class MySqlRepositoryIT {

    @Container
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.4")
            .withDatabaseName("smart_service")
            .withUsername("smart_service")
            .withPassword("smart_service");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MYSQL::getJdbcUrl);
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
    }

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private KnowledgeArticleRepository articleRepository;

    @Autowired
    private UserAccountRepository userAccountRepository;

    @Test
    void persistsOwnershipAndFiltersTickets() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, "requester-one");
        ticket.assignTo("agent-one");
        ticketRepository.saveAndFlush(ticket);

        var results = ticketRepository.search(TicketStatus.OPEN, TicketPriority.P1, "agent-one",
                "requester-one", false, Instant.now(), PageRequest.of(0, 20));

        assertThat(results).singleElement().satisfies(found -> {
            assertThat(found.getRequesterUsername()).isEqualTo("requester-one");
            assertThat(found.getAssigneeUsername()).isEqualTo("agent-one");
            assertThat(found.getDueAt()).isAfter(found.getCreatedAt());
        });
    }

    @Test
    void filtersBreachedTicketsAndCalculatesSlaMetrics() {
        Ticket late = new Ticket("Production outage", "Checkout unavailable", TicketPriority.P1,
                "requester-sla", Instant.now().minusSeconds(5 * 60 * 60));
        Ticket onTrack = new Ticket("Production latency", "Checkout is slow", TicketPriority.P1,
                "requester-sla");
        ticketRepository.saveAllAndFlush(Set.of(late, onTrack));

        var breached = ticketRepository.search(null, null, null, "requester-sla",
                true, Instant.now(), PageRequest.of(0, 20));

        assertThat(breached).extracting(Ticket::getTitle).containsExactly("Production outage");
        assertThat(ticketRepository.countSlaBreached(Instant.now())).isGreaterThanOrEqualTo(1);
        assertThat(ticketRepository.countDueSoon(Instant.now(), Instant.now().plusSeconds(6 * 60 * 60)))
                .isGreaterThanOrEqualTo(1);
    }

    @Test
    void searchesOnlyPublishedKnowledgeWithMySqlFullTextIndex() {
        KnowledgeArticle published = new KnowledgeArticle("VPN gateway recovery", "Restore remote access",
                "Restart the gateway service and verify the tunnel connection.", "Network", "agent-one");
        published.publish("agent-one");
        articleRepository.saveAndFlush(published);
        articleRepository.saveAndFlush(new KnowledgeArticle("VPN draft", "Unreviewed notes",
                "Gateway troubleshooting draft content.", "Network", "agent-one"));

        var results = articleRepository.searchPublished("gateway", PageRequest.of(0, 20));

        assertThat(results).extracting(KnowledgeArticle::getTitle)
                .contains("VPN gateway recovery")
                .doesNotContain("VPN draft");
    }

    @Test
    void persistsUserAccountRoles() {
        UserAccount agent = new UserAccount(
                "agent-integration", "encoded-password", Set.of(UserRole.AGENT));
        UserAccount requester = new UserAccount(
                "requester-integration", "encoded-password", Set.of(UserRole.REQUESTER));
        UserAccount disabledAdmin = new UserAccount(
                "disabled-admin-integration", "encoded-password", Set.of(UserRole.ADMIN));
        disabledAdmin.changeEnabled(false);
        userAccountRepository.saveAllAndFlush(Set.of(agent, requester, disabledAdmin));

        UserAccount account = userAccountRepository.findByUsernameIgnoreCase("AGENT-INTEGRATION").orElseThrow();
        var assignable = userAccountRepository.findAssignableUsers(
                Set.of(UserRole.ADMIN, UserRole.AGENT), PageRequest.of(0, 20));

        assertThat(account.isEnabled()).isTrue();
        assertThat(account.getRoles()).containsExactly(UserRole.AGENT);
        assertThat(assignable).extracting(UserAccount::getUsername)
                .contains("agent-integration")
                .doesNotContain("requester-integration", "disabled-admin-integration");
    }
}
