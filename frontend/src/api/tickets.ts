import { apiClient } from "./client";
import type { TicketResponse, CreateTicketRequest, TicketListParams } from "@/types/ticket";
import type { PageResponse } from "@/types/api";
import type { TicketStatus } from "@/types/domain";

// --- Tickets ---

export async function fetchTickets(
  params: TicketListParams
): Promise<PageResponse<TicketResponse>> {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.priority) sp.set("priority", params.priority);
  if (params.assignee) sp.set("assignee", params.assignee);
  sp.set("page", String(params.page));
  sp.set("size", String(params.size));
  if (params.sort) sp.set("sort", params.sort);
  const r = await apiClient.get<PageResponse<TicketResponse>>(`/tickets?${sp}`);
  return r.data;
}

export async function fetchTicket(id: number): Promise<TicketResponse> {
  const r = await apiClient.get<TicketResponse>(`/tickets/${id}`);
  return r.data;
}

export async function createTicket(
  data: CreateTicketRequest
): Promise<TicketResponse> {
  const r = await apiClient.post<TicketResponse>("/tickets", data);
  return r.data;
}

// --- Comments ---

export interface CommentResponse {
  id: number;
  ticketId: number;
  authorUsername: string;
  content: string;
  createdAt: string;
}

export async function fetchComments(
  ticketId: number,
  page: number,
  size: number
): Promise<PageResponse<CommentResponse>> {
  const r = await apiClient.get<PageResponse<CommentResponse>>(
    `/tickets/${ticketId}/comments?page=${page}&size=${size}&sort=createdAt,asc`
  );
  return r.data;
}

export async function addComment(
  ticketId: number,
  content: string
): Promise<CommentResponse> {
  const r = await apiClient.post<CommentResponse>(
    `/tickets/${ticketId}/comments`,
    { content }
  );
  return r.data;
}

// --- Audit ---

export interface AuditEventResponse {
  id: number;
  ticketId: number;
  eventType: string;
  actorUsername: string;
  details: string;
  createdAt: string;
}

export async function fetchAuditEvents(
  ticketId: number,
  page: number,
  size: number
): Promise<PageResponse<AuditEventResponse>> {
  const r = await apiClient.get<PageResponse<AuditEventResponse>>(
    `/tickets/${ticketId}/audit-events?page=${page}&size=${size}&sort=createdAt,desc`
  );
  return r.data;
}

// --- Status ---

export async function transitionTicket(
  ticketId: number,
  status: TicketStatus
): Promise<TicketResponse> {
  const r = await apiClient.patch<TicketResponse>(
    `/tickets/${ticketId}/status`,
    { status }
  );
  return r.data;
}

// --- Assignee ---

export async function assignTicket(
  ticketId: number,
  username: string
): Promise<TicketResponse> {
  const r = await apiClient.patch<TicketResponse>(
    `/tickets/${ticketId}/assignee`,
    { username }
  );
  return r.data;
}

// --- Users (for assignee picker, ADMIN only) ---

export interface UserResponse {
  id: number;
  username: string;
  enabled: boolean;
  roles: string[];
  createdAt: string;
}

export async function fetchUsers(
  page: number,
  size: number
): Promise<PageResponse<UserResponse>> {
  const r = await apiClient.get<PageResponse<UserResponse>>(
    `/users?page=${page}&size=${size}`
  );
  return r.data;
}