import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth";

const SECONDS = (n: number) => Math.floor(Date.now() / 1000) + n;

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

beforeEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({
    accessToken: null,
    username: null,
    roles: [],
    isAuthenticated: false,
    isInitialized: false,
  });
});

describe("useAuthStore", () => {
  it("starts unauthenticated", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.username).toBeNull();
    expect(state.roles).toEqual([]);
  });

  it("login stores token and sets authenticated state", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN", exp: SECONDS(3600) });
    useAuthStore.getState().login(token);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.username).toBe("admin");
    expect(state.roles).toEqual(["ADMIN"]);
    expect(state.accessToken).toBe(token);
    expect(sessionStorage.getItem("accessToken")).toBe(token);
  });

  it("logout clears state and sessionStorage", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN", exp: SECONDS(3600) });
    useAuthStore.getState().login(token);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.username).toBeNull();
    expect(state.roles).toEqual([]);
    expect(sessionStorage.getItem("accessToken")).toBeNull();
  });

  it("initialize restores state from sessionStorage", () => {
    const token = makeToken({ sub: "agent-one", scope: "AGENT", exp: SECONDS(3600) });
    sessionStorage.setItem("accessToken", token);

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.username).toBe("agent-one");
    expect(state.roles).toEqual(["AGENT"]);
    expect(state.isInitialized).toBe(true);
  });

  it("initialize clears expired token from sessionStorage", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN", exp: SECONDS(-3600) });
    sessionStorage.setItem("accessToken", token);

    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(sessionStorage.getItem("accessToken")).toBeNull();
    expect(state.isInitialized).toBe(true);
  });

  it("initialize handles missing token gracefully", () => {
    useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.username).toBeNull();
    expect(state.isInitialized).toBe(true);
  });
});
