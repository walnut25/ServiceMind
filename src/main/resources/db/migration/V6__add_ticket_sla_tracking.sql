ALTER TABLE tickets
    ADD COLUMN due_at TIMESTAMP(6) NULL AFTER updated_at,
    ADD COLUMN resolved_at TIMESTAMP(6) NULL AFTER due_at;

UPDATE tickets
SET due_at = DATE_ADD(
        created_at,
        INTERVAL (CASE priority
            WHEN 'P1' THEN 4
            WHEN 'P2' THEN 8
            WHEN 'P3' THEN 24
            ELSE 72
        END) HOUR
    ),
    resolved_at = CASE
        WHEN status IN ('RESOLVED', 'CLOSED') THEN updated_at
        ELSE NULL
    END;

ALTER TABLE tickets
    MODIFY COLUMN due_at TIMESTAMP(6) NOT NULL;

CREATE INDEX idx_tickets_due_at ON tickets (due_at);
CREATE INDEX idx_tickets_resolved_due_at ON tickets (resolved_at, due_at);
