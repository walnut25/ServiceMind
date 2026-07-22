import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import type { UserRole } from "@/types/domain";
import type { ReactNode } from "react";

interface RoleGuardProps {
  roles: UserRole[];
  children: ReactNode;
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const userRoles = useAuthStore((s) => s.roles);

  const hasRole = roles.some((role) => userRoles.includes(role));

  if (!hasRole) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
