import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchTickets,
  fetchTicket,
  createTicket,
  fetchComments,
  addComment,
  fetchAuditEvents,
  transitionTicket,
  assignTicket,
  fetchUsers,
} from "@/api/tickets";
import type { TicketListParams, CreateTicketRequest } from "@/types/ticket";
import type { TicketStatus } from "@/types/domain";

export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: (params: TicketListParams) => [...ticketKeys.lists(), params] as const,
  details: () => [...ticketKeys.all, "detail"] as const,
  detail: (id: number) => [...ticketKeys.details(), id] as const,
  comments: (id: number) => [...ticketKeys.detail(id), "comments"] as const,
  audit: (id: number) => [...ticketKeys.detail(id), "audit"] as const,
  users: ["users"] as const,
};

export function useTicketList(params: TicketListParams) {
  return useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: () => fetchTickets(params),
    placeholderData: (prev) => prev,
  });
}

export function useTicket(id: number) {
  return useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => fetchTicket(id),
    enabled: id > 0,
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTicketRequest) => createTicket(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ticketKeys.lists() }),
  });
}

export function useComments(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.comments(ticketId),
    queryFn: () => fetchComments(ticketId, 0, 100),
    enabled: ticketId > 0,
  });
}

export function useAddComment(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => addComment(ticketId, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.comments(ticketId) });
      qc.invalidateQueries({ queryKey: ticketKeys.audit(ticketId) });
    },
  });
}

export function useAuditEvents(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.audit(ticketId),
    queryFn: () => fetchAuditEvents(ticketId, 0, 100),
    enabled: ticketId > 0,
  });
}

export function useTransitionTicket(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: TicketStatus) => transitionTicket(ticketId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
      qc.invalidateQueries({ queryKey: ticketKeys.lists() });
      qc.invalidateQueries({ queryKey: ticketKeys.audit(ticketId) });
    },
  });
}

export function useAssignTicket(ticketId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => assignTicket(ticketId, username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ticketKeys.detail(ticketId) });
      qc.invalidateQueries({ queryKey: ticketKeys.lists() });
      qc.invalidateQueries({ queryKey: ticketKeys.audit(ticketId) });
    },
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ticketKeys.users,
    queryFn: () => fetchUsers(0, 100),
    staleTime: 60_000,
  });
}