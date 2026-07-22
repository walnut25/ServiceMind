import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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

import { ArticleEditPage } from "@/pages/knowledge/ArticleEditPage";
import {
  fetchArticle,
  createArticle,
  publishArticle,
} from "@/api/knowledge";

function renderPage(route: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/knowledge/new" element={<ArticleEditPage />} />
              <Route path="/knowledge/:articleId/edit" element={<ArticleEditPage />} />
              <Route path="/knowledge/:articleId" element={<div data-testid="article-detail" />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

const mockArticle = {
  id: 1, title: "Existing", summary: "summary", content: "# content",
  category: "General", status: "DRAFT" as const,
  createdBy: "admin", updatedBy: "admin",
  createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
  publishedAt: null, version: 0,
};

describe("ArticleEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows validation errors for empty fields", async () => {
    renderPage("/knowledge/new");
    const saveBtn = screen.getByText("\u4fdd\u5b58\u8349\u7a3f");
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("\u8bf7\u8f93\u5165\u6807\u9898")).toBeDefined();
      expect(screen.getByText("\u8bf7\u8f93\u5165\u6458\u8981")).toBeDefined();
      expect(screen.getByText("\u8bf7\u8f93\u5165\u6b63\u6587")).toBeDefined();
      expect(screen.getByText("\u8bf7\u8f93\u5165\u5206\u7c7b")).toBeDefined();
    });
  });

  it("shows new article title for create mode", () => {
    renderPage("/knowledge/new");
    expect(screen.getByText("\u65b0\u5efa\u6587\u7ae0")).toBeDefined();
  });

  it("shows edit mode and loads existing data", async () => {
    vi.mocked(fetchArticle).mockResolvedValue(mockArticle);
    renderPage("/knowledge/1/edit");

    await waitFor(() => {
      expect(screen.getByText("\u7f16\u8f91\u6587\u7ae0")).toBeDefined();
    });
  });

  it("handles 409 conflict by preserving local content", async () => {
    vi.mocked(createArticle).mockRejectedValue({
      response: { status: 409 },
      isAxiosError: true,
    });
    renderPage("/knowledge/new");

    const titleInput = screen.getByPlaceholderText("\u6587\u7ae0\u6807\u9898");
    await userEvent.type(titleInput, "Test");
    await userEvent.type(
      screen.getByPlaceholderText("\u7b80\u77ed\u6458\u8981"),
      "summary"
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Markdown \u6b63\u6587/),
      "content"
    );
    await userEvent.type(
      screen.getByPlaceholderText(/\u4f8b\u5982/),
      "category"
    );

    const saveBtn = screen.getByText("\u4fdd\u5b58\u8349\u7a3f");
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(titleInput).toHaveValue("Test");
    });
  });

  it("calls publishArticle after saving when publish clicked", async () => {
    vi.mocked(createArticle).mockResolvedValue({
      ...mockArticle, id: 10, title: "Test", summary: "s", content: "c", category: "t",
    });
    vi.mocked(publishArticle).mockRejectedValue(new Error("Server error"));

    renderPage("/knowledge/new");
    await userEvent.type(
      screen.getByPlaceholderText("文章标题"),
      "Test"
    );
    await userEvent.type(
      screen.getByPlaceholderText("简短摘要"),
      "s"
    );
    await userEvent.type(
      screen.getByPlaceholderText(/Markdown 正文/),
      "c"
    );
    await userEvent.type(
      screen.getByPlaceholderText(/例如/),
      "t"
    );

    const publishBtn = screen.getByText("保存并发布");
    await userEvent.click(publishBtn);

    await vi.waitFor(() => {
      expect(vi.mocked(publishArticle)).toHaveBeenCalled();
    });
  });
});
