import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * O proxy /api/appwrite aceita mutações (POST/PUT/PATCH/DELETE) que encaminham
 * o client SDK do browser para o Appwrite. Como o proxy injeta a sessão
 * HttpOnly server-side, um site malicioso poderia induzir o browser a fazer
 * mutações cross-site (ex: criar documentos) se o proxy não validasse CSRF.
 *
 * Estes testes verificam que o proxy aplica csrfGuard a mutações e ignora
 * leituras (GET). O token é enviado pelo client SDK (src/lib/appwrite.ts).
 */
describe("appwrite proxy CSRF", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const PATH = ["databases", "db", "collections", "links", "documents"];

  it("rejects a POST without a CSRF token with 403", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    const { POST } = await import("@/app/api/appwrite/[...path]/route");

    const request = new NextRequest(
      "https://example.com/api/appwrite/databases/db/collections/links/documents",
      { method: "POST", body: "{}" },
    );
    const response = await POST(request, { params: Promise.resolve({ path: PATH }) });
    expect(response.status).toBe(403);
  });

  it("rejects a POST when the CSRF header does not match the cookie", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    const { POST } = await import("@/app/api/appwrite/[...path]/route");

    const request = new NextRequest(
      "https://example.com/api/appwrite/databases/db/collections/links/documents",
      {
        method: "POST",
        headers: { "x-csrf-token": "attacker-token" },
        body: "{}",
      },
    );
    // Cookie CSRF em dev/test chama-se "csrf-token" (ver lib/csrf.ts).
    request.cookies.set("csrf-token", "legit-token");
    const response = await POST(request, { params: Promise.resolve({ path: PATH }) });
    expect(response.status).toBe(403);
  });

  it("accepts a POST with a matching CSRF token (passes the guard)", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    const { POST } = await import("@/app/api/appwrite/[...path]/route");

    const request = new NextRequest(
      "https://example.com/api/appwrite/databases/db/collections/links/documents",
      {
        method: "POST",
        headers: { "x-csrf-token": "valid-token" },
        body: "{}",
      },
    );
    request.cookies.set("csrf-token", "valid-token");
    const response = await POST(request, { params: Promise.resolve({ path: PATH }) });
    // Não deve ser 403. Sem Upstash configurado o passo seguinte devolve 503
    // (fail-closed do rate limit) — o que prova que o guard CSRF passou.
    expect(response.status).not.toBe(403);
  });

  it("allows GET requests without a CSRF token (reads are not blocked)", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    const { GET } = await import("@/app/api/appwrite/[...path]/route");

    const request = new NextRequest(
      "https://example.com/api/appwrite/databases/db/collections/links/documents",
      { method: "GET" },
    );
    const response = await GET(request, { params: Promise.resolve({ path: PATH }) });
    // Sem token CSRF, mas GET é leitura → não pode ser 403 (pode ser 503
    // por falta de Redis/Upstash, nunca 403 de CSRF).
    expect(response.status).not.toBe(403);
  });
});
