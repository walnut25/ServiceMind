package dev.smartservice.ticket.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ticket_audit_events")
public class TicketAuditEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 40)
    private TicketAuditEventType eventType;

    @Column(name = "actor_username", nullable = false, length = 100)
    private String actorUsername;

    @Column(nullable = false, length = 500)
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected TicketAuditEvent() {
    }

    public TicketAuditEvent(long ticketId, TicketAuditEventType eventType, String actorUsername, String details) {
        this.ticketId = ticketId;
        this.eventType = eventType;
        this.actorUsername = actorUsername;
        this.details = details;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getTicketId() { return ticketId; }
    public TicketAuditEventType getEventType() { return eventType; }
    public String getActorUsername() { return actorUsername; }
    public String getDetails() { return details; }
    public Instant getCreatedAt() { return createdAt; }
}
