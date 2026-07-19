ALTER TABLE tickets
    ADD COLUMN requester_username VARCHAR(100) NULL AFTER status,
    ADD COLUMN assignee_username VARCHAR(100) NULL AFTER requester_username;

UPDATE tickets
SET requester_username = 'admin'
WHERE requester_username IS NULL;

ALTER TABLE tickets
    MODIFY COLUMN requester_username VARCHAR(100) NOT NULL,
    ADD INDEX idx_tickets_requester_created (requester_username, created_at),
    ADD INDEX idx_tickets_assignee_status (assignee_username, status);
