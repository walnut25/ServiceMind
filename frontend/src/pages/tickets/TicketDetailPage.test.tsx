import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider } from "antd";
import { useAuthStore } from "@/stores/auth";

vi.mock("@/api/tickets", () => ({
  fetchTickets: vi.fn(),
  fetchTicket: vi.fn(),
  createTicket: vi.fn(),
  fetchComments: vi.fn(),
  addComment: vi.fn(),
  fetchAuditEvents: vi.fn(),
  transitionTicket: vi.fn(),
  assignTicket: vi.fn(),
  fetchAssignableUsers: vi.fn(),
}));

import { TicketDetailPage } from "@/pages/tickets/TicketDetailPage";
import {
  fetchAssignableUsers,
  fetchAuditEvents,
  fetchComments,
  fetchTicket,
} from "@/api/tickets";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/tickets/999"]}>
            <Routes>
              <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

describe("TicketDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchTicket).mockRejectedValue({
      response: { status: 404 },
    });
    vi.mocked(fetchComments).mockResolvedValue({
      content: [],
      page: { size: 100, number: 0, totalElements: 0, totalPages: 0 },
    });
    useAuthStore.setState({
      accessToken: "token",
      username: "requester-one",
      roles: ["REQUESTER"],
      isAuthenticated: true,
      isInitialized: true,
    });
  });

  it("shows the privacy-preserving 404 state", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("工单不存在或你无权访问")).toBeDefined();
    });
  });

  it("does not request manager-only resources for a requester", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("工单不存在或你无权访问")).toBeDefined();
    });
    expect(fetchAuditEvents).not.toHaveBeenCalled();
    expect(fetchAssignableUsers).not.toHaveBeenCalled();
  });
});
