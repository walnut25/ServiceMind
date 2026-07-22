import { describe, it, expect } from "vitest";
import { parseJwtPayload, extractUserInfo, isTokenExpired } from "@/utils/jwt";

const SECONDS = (n: number) => Math.floor(Date.now() / 1000) + n;

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe("parseJwtPayload", () => {
  it("parses a valid JWT payload", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN", exp: SECONDS(3600), iss: "test" });
    const result = parseJwtPayload(token);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe("admin");
    expect(result!.scope).toBe("ADMIN");
  });

  it("returns null for an invalid token format", () => {
    expect(parseJwtPayload("not.a.token")).toBeNull();
    expect(parseJwtPayload("")).toBeNull();
    expect(parseJwtPayload("only-one-part")).toBeNull();
  });

  it("returns null for a token missing sub", () => {
    const token = makeToken({ scope: "ADMIN", exp: SECONDS(3600) });
    expect(parseJwtPayload(token)).toBeNull();
  });

  it("returns null for a token missing exp", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN" });
    expect(parseJwtPayload(token)).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("returns false for a valid token", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN", exp: SECONDS(3600) });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true for an expired token", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN", exp: SECONDS(-3600) });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true for an invalid token", () => {
    expect(isTokenExpired("garbage")).toBe(true);
  });
});

describe("extractUserInfo", () => {
  it("extracts username and roles from a valid token", () => {
    const token = makeToken({ sub: "agent-one", scope: "AGENT", exp: SECONDS(3600) });
    const result = extractUserInfo(token);
    expect(result).toEqual({ username: "agent-one", roles: ["AGENT"] });
  });

  it("extracts multiple roles", () => {
    const token = makeToken({ sub: "admin", scope: "ADMIN AGENT", exp: SECONDS(3600) });
    const result = extractUserInfo(token);
    expect(result).toEqual({ username: "admin", roles: ["ADMIN", "AGENT"] });
  });

  it("returns empty roles when scope is missing", () => {
    const token = makeToken({ sub: "user", exp: SECONDS(3600) });
    const result = extractUserInfo(token);
    expect(result).toEqual({ username: "user", roles: [] });
  });
});
