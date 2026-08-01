/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { middleware } from "@/middleware";
import type { NextRequest } from "next/server";

function makeRequest(pathname: string, method = "GET", cookieName?: string): NextRequest {
  const cookies = cookieName ? [{ name: cookieName, value: "session-value" }] : [];
  return {
    method,
    url: `http://localhost:3000${pathname}`,
    nextUrl: { pathname },
    cookies: {
      get: (name: string) => cookies.find((c) => c.name === name),
      getAll: () => cookies,
    },
  } as unknown as NextRequest;
}

describe("middleware — proteção server-side de /dashboard e /api (M1)", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID = "testproj";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  });

  it("redireciona /dashboard para /login quando não existe cookie de sessão", () => {
    const res = middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("permite /dashboard com cookie de sessão Appwrite presente", () => {
    const res = middleware(makeRequest("/dashboard", "GET", "a_session_testproj"));
    expect(res.status).toBe(200);
  });

  it("devolve 401 em mutações /api sem sessão", () => {
    const res = middleware(makeRequest("/api/security/log", "POST"));
    expect(res.status).toBe(401);
  });

  it("não bloqueia endpoints públicos anónimos (ex: /api/view)", () => {
    const res = middleware(makeRequest("/api/view", "POST"));
    expect(res.status).toBe(200);
  });

  it("não bloqueia GET /api sem sessão (as rotas fazem requireAuth próprio)", () => {
    const res = middleware(makeRequest("/api/security/logs", "GET"));
    expect(res.status).toBe(200);
  });
});
