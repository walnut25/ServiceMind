import { apiClient } from "./client";
import type { ArticleResponse, ArticleRequest } from "@/types/knowledge";
import type { PageResponse } from "@/types/api";

export async function fetchArticles(
  page: number,
  size: number
): Promise<PageResponse<ArticleResponse>> {
  const r = await apiClient.get<PageResponse<ArticleResponse>>(
    `/knowledge/articles?page=${page}&size=${size}`
  );
  return r.data;
}

export async function searchArticles(
  query: string,
  page: number,
  size: number
): Promise<PageResponse<ArticleResponse>> {
  const r = await apiClient.get<PageResponse<ArticleResponse>>(
    `/knowledge/articles/search?query=${encodeURIComponent(query)}&page=${page}&size=${size}`
  );
  return r.data;
}

export async function fetchArticle(id: number): Promise<ArticleResponse> {
  const r = await apiClient.get<ArticleResponse>(`/knowledge/articles/${id}`);
  return r.data;
}

export async function createArticle(
  data: ArticleRequest
): Promise<ArticleResponse> {
  const r = await apiClient.post<ArticleResponse>("/knowledge/articles", data);
  return r.data;
}

export async function updateArticle(
  id: number,
  data: ArticleRequest
): Promise<ArticleResponse> {
  const r = await apiClient.put<ArticleResponse>(
    `/knowledge/articles/${id}`,
    data
  );
  return r.data;
}

export async function publishArticle(id: number): Promise<ArticleResponse> {
  const r = await apiClient.post<ArticleResponse>(
    `/knowledge/articles/${id}/publish`
  );
  return r.data;
}

export async function archiveArticle(id: number): Promise<ArticleResponse> {
  const r = await apiClient.post<ArticleResponse>(
    `/knowledge/articles/${id}/archive`
  );
  return r.data;
}