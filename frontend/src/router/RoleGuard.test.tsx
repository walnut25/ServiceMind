import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { RoleGuard } from "@/router/RoleGuard";

beforeEach(() => {
  useAuthStore.setState({
    accessToken: "token",
    username: "testuser",
    roles: ["REQUESTER"],
    isAuthenticated: true,
    isInitialized: true,
  });
});

describe("RoleGuard", () => {
  it("renders children when user has the required role", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RoleGuard roles={["REQUESTER"]}>
                <div>Admin Panel</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Admin Panel")).toBeDefined();
  });

  it("redirects to /403 when user does not have the required role", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RoleGuard roles={["ADMIN"]}>
                <div>Admin Panel</div>
              </RoleGuard>
            }
          />
          <Route path="/403" element={<div>Forbidden</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Forbidden")).toBeDefined();
    expect(screen.queryByText("Admin Panel")).toBeNull();
  });

  it("grants access when user has one of multiple required roles", () => {
    useAuthStore.setState({
      accessToken: "token",
      username: "agent",
      roles: ["AGENT"],
      isAuthenticated: true,
      isInitialized: true,
    });

    render(
      <MemoryRouter initialEntries={["/knowledge/new"]}>
        <Routes>
          <Route
            path="/knowledge/new"
            element={
              <RoleGuard roles={["ADMIN", "AGENT"]}>
                <div>New Article</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("New Article")).toBeDefined();
  });
});
