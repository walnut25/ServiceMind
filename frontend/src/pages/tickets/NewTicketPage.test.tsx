import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import { NewTicketPage } from "@/pages/tickets/NewTicketPage";

const server = setupServer(
  http.post("/api/v1/tickets", async () => {
    return HttpResponse.json(
      { id: 1, title: "test", description: "desc", priority: "P3", status: "OPEN", requesterUsername: "admin", assigneeUsername: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z", version: 0 },
      { status: 201 }
    );
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/tickets/new"]}>
            <NewTicketPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

describe("NewTicketPage", () => {
  it("shows validation errors for empty form", async () => {
    renderPage();
    const button = screen.getByRole("button", { name: /提交/ });
    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("请输入工单标题")).toBeDefined();
      expect(screen.getByText("请输入工单描述")).toBeDefined();
    });
  });

  it("shows title character count", () => {
    renderPage();
    expect(screen.getByText("0/200")).toBeDefined();
  });

  it("has priority default set to P3", () => {
    renderPage();
    expect(screen.getByText("中")).toBeDefined();
  });


});