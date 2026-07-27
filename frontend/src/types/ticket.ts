import type { TicketStatus, TicketPriority, TicketSlaStatus } from "@/types/domain";

export interface TicketResponse {
  id: number;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  requesterUsername: string;
  assigneeUsername: string | null;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
  resolvedAt: string | null;
  slaStatus: TicketSlaStatus;
  version: number;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  priority: TicketPriority;
}

export interface TicketListParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignee?: string;
  slaBreached?: boolean;
  page: number;
  size: number;
  sort?: string;
}

export interface TicketMetrics {
  generatedAt: string;
  total: number;
  active: number;
  unassignedActive: number;
  breached: number;
  dueSoon: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
}
