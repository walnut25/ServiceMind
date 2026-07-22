import { apiClient } from "./client";
import type { TicketResponse, CreateTicketRequest, TicketListParams } from "@/types/ticket";
import type { PageResponse } from "@/types/api";

export async function fetchTickets(
  params: TicketListParams
): Promise<PageResponse<TicketResponse>> {
  const searchParams = new URLSearchParams();

  if (params.status) searchParams.set("status", params.status);
  if (params.priority) searchParams.set("priority", params.priority);
  if (params.assignee) searchParams.set("assignee", params.assignee);
  searchParams.set("page", String(params.page));
  searchParams.set("size", String(params.size));
  if (params.sort) searchParams.set("sort", params.sort);

  const response = await apiClient.get<PageResponse<TicketResponse>>(
    `/tickets?${searchParams.toString()}`
  );
  return response.data;
}

export async function fetchTicket(id: number): Promise<TicketResponse> {
  const response = await apiClient.get<TicketResponse>(`/tickets/${id}`);
  return response.data;
}

export async function createTicket(
  data: CreateTicketRequest
): Promise<TicketResponse> {
  const response = await apiClient.post<TicketResponse>("/tickets", data);
  return response.data;
}