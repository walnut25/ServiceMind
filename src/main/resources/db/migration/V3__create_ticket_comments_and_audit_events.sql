CREATE TABLE ticket_comments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT NOT NULL,
    author_username VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_ticket_comments_ticket_created (ticket_id, created_at),
    CONSTRAINT fk_ticket_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
);

CREATE TABLE ticket_audit_events (
    id BIGINT NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    actor_username VARCHAR(100) NOT NULL,
    details VARCHAR(500) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_ticket_audit_ticket_created (ticket_id, created_at),
    CONSTRAINT fk_ticket_audit_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id)
);
