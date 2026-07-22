import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import { useAuthStore } from "@/stores/auth";
import { LoginPage } from "@/pages/login/LoginPage";

const server = setupServer(
  http.post("/api/v1/auth/login", async () => {
    return HttpResponse.json(
      { title: "Authentication failed", detail: "Invalid username or password", status: 401, instance: "/api/v1/auth/login" },
      { status: 401 }
    );
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  sessionStorage.clear();
  useAuthStore.setState({
    accessToken: null,
    username: null,
    roles: [],
    isAuthenticated: false,
    isInitialized: true,
  });
});
afterAll(() => server.close());

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/login"]}>
            <LoginPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

function getLoginButton() {
  return screen.getByRole("button", { name: /登.*录/ });
}

describe("LoginPage", () => {
  it("renders the login form with all elements", () => {
    renderLogin();
    expect(screen.getByPlaceholderText("用户名")).toBeDefined();
    expect(screen.getByPlaceholderText("密码")).toBeDefined();
    expect(getLoginButton()).toBeDefined();
    expect(screen.getByText("ServiceMind")).toBeDefined();
    expect(screen.getByText("欢迎回来")).toBeDefined();
  });

  it("shows validation errors for empty fields", async () => {
    renderLogin();
    await userEvent.click(getLoginButton());

    await waitFor(() => {
      expect(screen.getByText("请输入用户名")).toBeDefined();
      expect(screen.getByText("请输入密码")).toBeDefined();
    });
  });
});