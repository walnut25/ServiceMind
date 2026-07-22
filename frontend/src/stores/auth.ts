import { create } from "zustand";
import type { UserRole } from "@/types/domain";
import { extractUserInfo, isTokenExpired } from "@/utils/jwt";

interface AuthState {
  accessToken: string | null;
  username: string | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (token: string) => void;
  logout: () => void;
  initialize: () => void;
}

const TOKEN_KEY = "accessToken";

function loadTokenFromStorage(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    if (isTokenExpired(token)) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

function getStateFromToken(token: string | null): Pick<
  AuthState,
  "accessToken" | "username" | "roles" | "isAuthenticated"
> {
  if (!token) {
    return {
      accessToken: null,
      username: null,
      roles: [] as UserRole[],
      isAuthenticated: false,
    };
  }

  const info = extractUserInfo(token);
  if (!info) {
    sessionStorage.removeItem(TOKEN_KEY);
    return {
      accessToken: null,
      username: null,
      roles: [] as UserRole[],
      isAuthenticated: false,
    };
  }

  return {
    accessToken: token,
    username: info.username,
    roles: info.roles,
    isAuthenticated: true,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...getStateFromToken(null),
  isInitialized: false,

  login: (token: string) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    set({ ...getStateFromToken(token), isInitialized: true });
  },

  logout: () => {
    sessionStorage.removeItem(TOKEN_KEY);
    set({
      accessToken: null,
      username: null,
      roles: [],
      isAuthenticated: false,
      isInitialized: true,
    });
  },

  initialize: () => {
    const token = loadTokenFromStorage();
    set({ ...getStateFromToken(token), isInitialized: true });
  },
}));
