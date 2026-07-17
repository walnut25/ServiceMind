package dev.smartservice.ticket.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "ticket_comments")
public class TicketComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(name = "author_username", nullable = false, length = 100)
    private String authorUsername;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected TicketComment() {
    }

    public TicketComment(long ticketId, String authorUsername, String content) {
        this.ticketId = ticketId;
        this.authorUsername = authorUsername;
        this.content = content;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getTicketId() { return ticketId; }
    public String getAuthorUsername() { return authorUsername; }
    public String getContent() { return content; }
    public Instant getCreatedAt() { return createdAt; }
}
