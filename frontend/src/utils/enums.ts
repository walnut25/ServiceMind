import type { TicketStatus, TicketPriority, ArticleStatus, TicketAuditEventType } from "@/types/domain";

export const ticketStatusLabels: Record<TicketStatus, string> = {
  OPEN: "待处理",
  IN_PROGRESS: "处理中",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  P1: "紧急",
  P2: "高",
  P3: "中",
  P4: "低",
};

export const articleStatusLabels: Record<ArticleStatus, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

export const auditEventTypeLabels: Record<TicketAuditEventType, string> = {
  TICKET_CREATED: "创建工单",
  STATUS_CHANGED: "状态变更",
  COMMENT_ADDED: "添加评论",
  ASSIGNEE_CHANGED: "变更负责人",
};
