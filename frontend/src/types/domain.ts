export type UserRole = "ADMIN" | "AGENT" | "REQUESTER";

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type TicketPriority = "P1" | "P2" | "P3" | "P4";

export type ArticleStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type TicketAuditEventType =
  | "TICKET_CREATED"
  | "STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "ASSIGNEE_CHANGED";
