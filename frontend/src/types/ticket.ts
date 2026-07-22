import type { TicketStatus, TicketPriority } from "@/types/domain";

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
  page: number;
  size: number;
  sort?: string;
}