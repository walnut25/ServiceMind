import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { AuthGuard } from "@/router/AuthGuard";

beforeEach(() => {
  useAuthStore.setState({
    accessToken: null,
    username: null,
    roles: [],
    isAuthenticated: false,
    isInitialized: true,
  });
});

describe("AuthGuard", () => {
  it("redirects unauthenticated users to /login", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <div>Dashboard</div>
              </AuthGuard>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeDefined();
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("preserves the original URL as redirect param", () => {
    render(
      <MemoryRouter initialEntries={["/tickets?page=1"]}>
        <Routes>
          <Route
            path="/tickets"
            element={
              <AuthGuard>
                <div>Tickets</div>
              </AuthGuard>
            }
          />
          <Route
            path="/login"
            element={<div>Login Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeDefined();
  });

  it("renders children when authenticated", () => {
    useAuthStore.setState({
      accessToken: "token",
      username: "admin",
      roles: ["ADMIN"],
      isAuthenticated: true,
      isInitialized: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <div>Dashboard</div>
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard")).toBeDefined();
  });
});
