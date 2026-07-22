import { auditEventTypeLabels } from "./enums";

export function formatAuditEvent(eventType: string, details: string): string {
  const label = auditEventTypeLabels[eventType as keyof typeof auditEventTypeLabels];
  if (!label) {
    return details || eventType || "未知事件";
  }

  if (eventType === "STATUS_CHANGED" && details) {
    return `${label}：${details}`;
  }
  if (eventType === "ASSIGNEE_CHANGED" && details) {
    return `${label}：${details}`;
  }

  return label;
}