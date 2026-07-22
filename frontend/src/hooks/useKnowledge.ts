import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchArticles,
  searchArticles,
  fetchArticle,
  createArticle,
  updateArticle,
  publishArticle,
  archiveArticle,
} from "@/api/knowledge";
import type { ArticleRequest } from "@/types/knowledge";

export const knowledgeKeys = {
  all: ["knowledge"] as const,
  lists: () => [...knowledgeKeys.all, "list"] as const,
  list: (page: number, size: number) =>
    [...knowledgeKeys.lists(), { page, size }] as const,
  search: (query: string, page: number, size: number) =>
    [...knowledgeKeys.all, "search", { query, page, size }] as const,
  details: () => [...knowledgeKeys.all, "detail"] as const,
  detail: (id: number) => [...knowledgeKeys.details(), id] as const,
};

export function useArticleList(page: number, size: number) {
  return useQuery({
    queryKey: knowledgeKeys.list(page, size),
    queryFn: () => fetchArticles(page, size),
    placeholderData: (prev) => prev,
  });
}

export function useArticleSearch(query: string, page: number, size: number) {
  return useQuery({
    queryKey: knowledgeKeys.search(query, page, size),
    queryFn: () => searchArticles(query, page, size),
    enabled: query.length > 0,
  });
}

export function useArticle(id: number) {
  return useQuery({
    queryKey: knowledgeKeys.detail(id),
    queryFn: () => fetchArticle(id),
    enabled: id > 0,
  });
}

export function useCreateArticle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ArticleRequest) => createArticle(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: knowledgeKeys.lists() }),
  });
}

export function useUpdateArticle(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ArticleRequest) => updateArticle(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: knowledgeKeys.lists() });
    },
  });
}

export function usePublishArticle(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => publishArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: knowledgeKeys.lists() });
    },
  });
}

export function useArchiveArticle(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => archiveArticle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: knowledgeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: knowledgeKeys.lists() });
    },
  });
}