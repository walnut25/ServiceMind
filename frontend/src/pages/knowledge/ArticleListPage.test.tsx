import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";

vi.mock("@/api/knowledge", () => ({
  fetchArticles: vi.fn(),
  searchArticles: vi.fn(),
  fetchArticle: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  publishArticle: vi.fn(),
  archiveArticle: vi.fn(),
}));

import { ArticleListPage } from "@/pages/knowledge/ArticleListPage";
import { fetchArticles, searchArticles } from "@/api/knowledge";

function renderPage(route = "/knowledge") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[route]}>
            <ArticleListPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

describe("ArticleListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders article cards after loading", async () => {
    vi.mocked(fetchArticles).mockResolvedValue({
      content: [
        {
          id: 1, title: "Getting Started", summary: "A quick start guide",
          content: "# Hello", category: "General", status: "PUBLISHED" as const,
          createdBy: "admin", updatedBy: "admin",
          createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z",
          publishedAt: "2024-01-02T00:00:00Z", version: 0,
        },
      ],
      page: { size: 12, number: 0, totalElements: 1, totalPages: 1 },
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Getting Started")).toBeDefined();
    });
  });

  it("shows empty state for search with no results", async () => {
    vi.mocked(fetchArticles).mockResolvedValue({
      content: [],
      page: { size: 12, number: 0, totalElements: 0, totalPages: 0 },
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("\u6682\u65e0\u6587\u7ae0")).toBeDefined();
    });
  });

  it("searches using searchArticles when query param present", async () => {
    vi.mocked(searchArticles).mockResolvedValue({
      content: [],
      page: { size: 12, number: 0, totalElements: 0, totalPages: 0 },
    });

    renderPage("/knowledge?q=test");
    await waitFor(() => {
      expect(vi.mocked(searchArticles)).toHaveBeenCalled();
    });
  });
});
