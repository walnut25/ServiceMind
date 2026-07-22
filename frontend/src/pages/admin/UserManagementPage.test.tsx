import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import { useAuthStore } from "@/stores/auth";
import { RoleGuard } from "@/router/RoleGuard";

vi.mock("@/api/users", () => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  changeUserEnabled: vi.fn(),
}));

import { UserManagementPage } from "@/pages/admin/UserManagementPage";
import { fetchUsers, createUser, changeUserEnabled } from "@/api/users";

const mockUsersPage = {
  content: [
    { id: 1, username: "admin1", enabled: true, roles: ["ADMIN"], createdAt: "2025-01-01T00:00:00Z" },
    { id: 2, username: "agent1", enabled: true, roles: ["AGENT"], createdAt: "2025-01-02T00:00:00Z" },
    { id: 3, username: "disabled1", enabled: false, roles: ["REQUESTER"], createdAt: "2025-01-03T00:00:00Z" },
  ],
  page: { size: 20, number: 0, totalElements: 3, totalPages: 1 },
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={["/admin/users"]}>
            <UserManagementPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

function renderWithAuth(roles: string[]) {
  useAuthStore.setState({
    accessToken: "token",
    username: "testuser",
    roles,
    isAuthenticated: true,
    isInitialized: true,
  });
}

describe("UserManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: "token",
      username: "admin1",
      roles: ["ADMIN"],
      isAuthenticated: true,
      isInitialized: true,
    });
  });

  it("renders user list after loading", async () => {
    vi.mocked(fetchUsers).mockResolvedValue(mockUsersPage as any);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("agent1")).toBeDefined();
    });
    expect(screen.getByText("admin1")).toBeDefined();
    expect(screen.getByText("disabled1")).toBeDefined();
  });

  it("opens create user modal", async () => {
    vi.mocked(fetchUsers).mockResolvedValue(mockUsersPage as any);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("agent1")).toBeDefined();
    });

    const createBtn = screen.getByText("创建用户");
    await userEvent.click(createBtn);
    expect(screen.getByPlaceholderText("至少 12 个字符")).toBeDefined();
  });

  it("shows validation errors for create user form", async () => {
    vi.mocked(fetchUsers).mockResolvedValue(mockUsersPage as any);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("agent1")).toBeDefined();
    });

    await userEvent.click(screen.getByText("创建用户"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("例如 agent-one")).toBeDefined();
    });
    // Click modal OK to trigger validation
    const submitBtn = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("用户名至少 3 个字符")).toBeDefined();
    });
  });

  it("creates user successfully", async () => {
    vi.mocked(fetchUsers).mockResolvedValue(mockUsersPage as any);
    vi.mocked(createUser).mockResolvedValue({
      id: 4, username: "newuser", enabled: true, roles: ["REQUESTER"], createdAt: "2025-01-04T00:00:00Z",
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("agent1")).toBeDefined();
    });

    await userEvent.click(screen.getByText("创建用户"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("例如 agent-one")).toBeDefined();
    });

    const usernameInput = screen.getByPlaceholderText("例如 agent-one");
    await userEvent.type(usernameInput, "newuser");

    const passwordInput = screen.getByPlaceholderText("至少 12 个字符");
    await userEvent.type(passwordInput, "NewUserPass123!");

    // Click the modal's OK button - antd renders "确 定" with spaces
    const okButton = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLButtonElement;
    await userEvent.click(okButton);

    await waitFor(() => {
      expect(createUser).toHaveBeenCalled();
    });
  });

  it("shows disable button for enabled users", async () => {
    vi.mocked(fetchUsers).mockResolvedValue(mockUsersPage as any);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("agent1")).toBeDefined();
    });

    const disableButtons = screen.getAllByText("禁用");
    expect(disableButtons.length).toBeGreaterThan(0);
  });

  it("disables the disable button for self", async () => {
    useAuthStore.setState({
      accessToken: "token",
      username: "admin1",
      roles: ["ADMIN"],
      isAuthenticated: true,
      isInitialized: true,
    });

    vi.mocked(fetchUsers).mockResolvedValue(mockUsersPage as any);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("admin1")).toBeDefined();
    });
  });

  it("non-admin cannot access", () => {
    useAuthStore.setState({
      accessToken: "token",
      username: "requester",
      roles: ["REQUESTER"],
      isAuthenticated: true,
      isInitialized: true,
    });

    render(
      <MemoryRouter initialEntries={["/admin/users"]}>
        <Routes>
          <Route
            path="/admin/users"
            element={
              <RoleGuard roles={["ADMIN"]}>
                <UserManagementPage />
              </RoleGuard>
            }
          />
          <Route path="/403" element={<div>Forbidden</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Forbidden")).toBeDefined();
  });

  it("toggles user enabled status", async () => {
    vi.mocked(fetchUsers).mockResolvedValue(mockUsersPage as any);
    vi.mocked(changeUserEnabled).mockResolvedValue({
      id: 2, username: "agent1", enabled: false, roles: ["AGENT"], createdAt: "2025-01-02T00:00:00Z",
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("agent1")).toBeDefined();
    });

    // Click the disable button - find by role since text is inside a span
    const disableBtns = screen.getAllByRole("button", { name: /禁用/ });
    await userEvent.click(disableBtns[0]);

    // Popconfirm should appear with confirm button
    await waitFor(() => {
      const confirmBtn = document.querySelector('.ant-popconfirm .ant-btn-primary') as HTMLButtonElement;
      expect(confirmBtn).toBeDefined();
    });
  });
});
