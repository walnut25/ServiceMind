package dev.smartservice.ticket.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;

@Entity
@Table(name = "tickets")
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TicketPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TicketStatus status;

    @Column(name = "requester_username", nullable = false, updatable = false, length = 100)
    private String requesterUsername;

    @Column(name = "assignee_username", length = 100)
    private String assigneeUsername;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    private long version;

    protected Ticket() {
    }

    public Ticket(String title, String description, TicketPriority priority, String requesterUsername) {
        this.title = title;
        this.description = description;
        this.priority = priority;
        this.status = TicketStatus.OPEN;
        this.requesterUsername = requesterUsername;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public void assignTo(String assigneeUsername) {
        this.assigneeUsername = assigneeUsername;
        this.updatedAt = Instant.now();
    }

    public boolean isRequestedBy(String username) {
        return requesterUsername.equalsIgnoreCase(username);
    }

    public void transitionTo(TicketStatus target) {
        if (!status.canTransitionTo(target)) {
            throw new InvalidTicketTransitionException(status, target);
        }
        status = target;
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public TicketPriority getPriority() { return priority; }
    public TicketStatus getStatus() { return status; }
    public String getRequesterUsername() { return requesterUsername; }
    public String getAssigneeUsername() { return assigneeUsername; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public long getVersion() { return version; }
}
