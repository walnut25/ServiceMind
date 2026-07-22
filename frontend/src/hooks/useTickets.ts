import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTickets, fetchTicket, createTicket } from "@/api/tickets";
import type { TicketListParams, CreateTicketRequest } from "@/types/ticket";

export const ticketKeys = {
  all: ["tickets"] as const,
  lists: () => [...ticketKeys.all, "list"] as const,
  list: (params: TicketListParams) => [...ticketKeys.lists(), params] as const,
  details: () => [...ticketKeys.all, "detail"] as const,
  detail: (id: number) => [...ticketKeys.details(), id] as const,
};

export function useTicketList(params: TicketListParams) {
  return useQuery({
    queryKey: ticketKeys.list(params),
    queryFn: () => fetchTickets(params),
    placeholderData: (previousData) => previousData,
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTicketRequest) => createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.lists() });
    },
  });
}