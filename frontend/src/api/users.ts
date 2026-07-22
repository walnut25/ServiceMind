import { apiClient } from "./client";
import type { UserResponse, CreateUserRequest } from "@/types/users";
import type { PageResponse } from "@/types/api";

export async function fetchUsers(
  page: number,
  size: number
): Promise<PageResponse<UserResponse>> {
  const r = await apiClient.get<PageResponse<UserResponse>>(
    "/users?page=" + page + "&size=" + size
  );
  return r.data;
}

export async function createUser(
  data: CreateUserRequest
): Promise<UserResponse> {
  const r = await apiClient.post<UserResponse>("/users", data);
  return r.data;
}

export async function changeUserEnabled(
  id: number,
  enabled: boolean
): Promise<UserResponse> {
  const r = await apiClient.patch<UserResponse>(
    "/users/" + id + "/enabled",
    { enabled }
  );
  return r.data;
}
