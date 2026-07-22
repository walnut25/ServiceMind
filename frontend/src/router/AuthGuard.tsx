import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import type { ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const location = useLocation();

  if (!isInitialized) return null;

  if (!isAuthenticated) {
    const returnUrl = location.pathname + location.search;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(returnUrl)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}
