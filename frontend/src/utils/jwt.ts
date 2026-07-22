import type { UserRole } from "@/types/domain";

interface JwtPayload {
  sub: string;
  scope: string;
  iss: string;
  iat: number;
  exp: number;
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    throw new Error("Invalid JWT encoding");
  }
}

export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
    if (!payload.sub || !payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload) return true;
  return payload.exp * 1000 < Date.now();
}

export function extractUserInfo(
  token: string
): { username: string; roles: UserRole[] } | null {
  const payload = parseJwtPayload(token);
  if (!payload) return null;

  const roles = payload.scope
    ? (payload.scope.split(" ") as UserRole[])
    : [];

  return { username: payload.sub, roles };
}
