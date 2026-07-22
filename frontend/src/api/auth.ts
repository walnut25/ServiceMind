import { apiClient } from "./client";
import type { LoginRequest, LoginResponse } from "@/types/auth";

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    "/auth/login",
    data
  );
  return response.data;
}
