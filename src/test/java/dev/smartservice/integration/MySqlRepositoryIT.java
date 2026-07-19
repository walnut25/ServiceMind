package dev.smartservice.integration;

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

    @Test
    void persistsOwnershipAndFiltersTickets() {
        Ticket ticket = new Ticket("VPN unavailable", "Cannot connect", TicketPriority.P1, "requester-one");
        ticket.assignTo("agent-one");
        ticketRepository.saveAndFlush(ticket);

        var results = ticketRepository.search(TicketStatus.OPEN, TicketPriority.P1, "agent-one",
                "requester-one", PageRequest.of(0, 20));

        assertThat(results).singleElement().satisfies(found -> {
            assertThat(found.getRequesterUsername()).isEqualTo("requester-one");
            assertThat(found.getAssigneeUsername()).isEqualTo("agent-one");
        });
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
}
