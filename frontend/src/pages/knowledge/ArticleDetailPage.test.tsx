import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";

// Mock the API module before importing the component
vi.mock("@/api/knowledge", () => ({
  fetchArticles: vi.fn(),
  searchArticles: vi.fn(),
  fetchArticle: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  publishArticle: vi.fn(),
  archiveArticle: vi.fn(),
}));

import { ArticleDetailPage } from "@/pages/knowledge/ArticleDetailPage";
import { fetchArticle } from "@/api/knowledge";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/knowledge/1"]}>
            <Routes>
              <Route path="/knowledge/:articleId" element={<ArticleDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

describe("ArticleDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders article title when data loads", async () => {
    const mockArticle = {
      id: 1,
      title: "Hello World",
      summary: "A test article",
      content: "# Test",
      category: "General",
      status: "PUBLISHED" as const,
      createdBy: "admin",
      updatedBy: "admin",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      publishedAt: "2024-01-01T00:00:00Z",
      version: 0,
    };
    vi.mocked(fetchArticle).mockResolvedValue(mockArticle);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeDefined();
    });
  });

  it("shows 404 for non-existent article", async () => {
    vi.mocked(fetchArticle).mockRejectedValue({
      response: { status: 404 },
      isAxiosError: true,
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/\u4e0d\u5b58\u5728/)).toBeDefined();
    });
  });

  it("shows error state with retry button", async () => {
    vi.mocked(fetchArticle).mockRejectedValue(new Error("Network error"));

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("\u52a0\u8f7d\u5931\u8d25")).toBeDefined();
      expect(screen.getByRole("button")).toBeDefined();
    });
  });
});
