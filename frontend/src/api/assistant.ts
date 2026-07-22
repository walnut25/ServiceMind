import { apiClient } from "./client";
import type { AskRequest, AskResponse } from "@/types/assistant";

export async function askQuestion(data: AskRequest): Promise<AskResponse> {
  const r = await apiClient.post<AskResponse>("/ai/answers", data);
  return r.data;
}
