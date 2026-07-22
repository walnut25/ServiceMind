import type { TicketStatus } from "@/types/domain";

const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "CLOSED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

export const transitionLabels: Record<TicketStatus, string> = {
  IN_PROGRESS: "开始处理",
  RESOLVED: "标记为已解决",
  OPEN: "重新打开",
  CLOSED: "关闭工单",
};

export function getAllowedTransitions(
  currentStatus: TicketStatus
): TicketStatus[] {
  return TRANSITIONS[currentStatus] ?? [];
}