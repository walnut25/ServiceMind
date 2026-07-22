import type { ArticleStatus } from "@/types/domain";

export interface ArticleResponse {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  status: ArticleStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  version: number;
}

export interface ArticleRequest {
  title: string;
  summary: string;
  content: string;
  category: string;
}