import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchUsers, createUser, changeUserEnabled } from "@/api/users";
import type { CreateUserRequest } from "@/types/users";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (page: number, size: number) =>
    [...userKeys.lists(), page, size] as const,
};

export function useUserList(page: number, size: number) {
  return useQuery({
    queryKey: userKeys.list(page, size),
    queryFn: () => fetchUsers(page, size),
    placeholderData: (prev) => prev,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserRequest) => createUser(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  });
}

export function useChangeUserEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      changeUserEnabled(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.lists() }),
  });
}
