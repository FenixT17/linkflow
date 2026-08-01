import { describe, it, expect, vi, afterEach } from "vitest";
import { generateToken, validateCsrfToken } from "@/lib/csrf";
import type { NextRequest } from "next/server";

describe("generateToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateToken();
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("generates unique tokens on each call", () => {
    const token1 = generateToken();
    const token2 = generateToken();
    expect(token1).not.toBe(token2);
  });

  it("uses cryptographically random values", () => {
    const token = generateToken();
    // Each byte is 0-255, so the hex should not be all zeros
    expect(token).not.toBe("0".repeat(64));
  });
});

describe("validateCsrfToken", () => {
  function createMockRequest(options: {
    cookieValue?: string;
    headerValue?: string;
  }): NextRequest {
    const { cookieValue, headerValue } = options;

    return {
      method: "POST",
      cookies: {
        get: (name: string) => {
          if (name === "csrf-token") {
            return { value: cookieValue };
          }
          return undefined;
        },
      },
      headers: new Headers(
        headerValue ? { "x-csrf-token": headerValue } : {}
      ),
    } as unknown as NextRequest;
  }

  it("returns true when cookie matches header", () => {
    const request = createMockRequest({
      cookieValue: "abc123",
      headerValue: "abc123",
    });
    expect(validateCsrfToken(request)).toBe(true);
  });

  it("returns false when cookie and header differ", () => {
    const request = createMockRequest({
      cookieValue: "abc123",
      headerValue: "different",
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when cookie is missing", () => {
    const request = createMockRequest({
      cookieValue: undefined,
      headerValue: "abc123",
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when header is missing", () => {
    const request = createMockRequest({
      cookieValue: "abc123",
      headerValue: undefined,
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("returns false when both are missing", () => {
    const request = createMockRequest({
      cookieValue: undefined,
      headerValue: undefined,
    });
    expect(validateCsrfToken(request)).toBe(false);
  });

  it("is timing-safe for different-length strings", () => {
    const request = createMockRequest({
      cookieValue: "short",
      headerValue: "muchlongerstring",
    });
    expect(validateCsrfToken(request)).toBe(false);
  });
});

describe("fetchWithCsrf — fail-closed sem token (M2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("lança erro (em vez de degradar silenciosamente) quando o token CSRF não está disponível", async () => {
    // Sem cookie CSRF e sem token em memória → initCsrfToken falha e marca
    // "__missing__". O fetchWithCsrf deve THROW e não enviar sem header.
    vi.stubGlobal("document", {
      ...(globalThis.document ?? {}),
      cookie: "",
    } as Document);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    const { initCsrfToken, fetchWithCsrf } = await import("@/hooks/use-csrf");
    await initCsrfToken(); // resolve para "__missing__" após falha

    await expect(
      fetchWithCsrf("/api/settings", { method: "POST" })
    ).rejects.toThrow(/CSRF/);
  });

  it("envia o header X-CSRF-Token quando o token está disponível", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "abc123" }), { status: 200 })) // initCsrfToken
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 })); // o pedido real
    vi.stubGlobal("fetch", fetchMock);

    const { fetchWithCsrf } = await import("@/hooks/use-csrf");
    // Primeira chamada: initCsrfToken busca o token; segunda: envia com header
    await expect(fetchWithCsrf("/api/test", { method: "POST" })).resolves.toBeDefined();
    const requestInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined;
    const headers = requestInit?.headers instanceof Headers ? requestInit.headers : new Headers(requestInit?.headers);
    expect(headers.get("x-csrf-token")).toBe("abc123");
  });
});
