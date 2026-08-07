import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
  if (originalNodeEnv === undefined) vi.stubEnv("NODE_ENV", undefined);
  else vi.stubEnv("NODE_ENV", originalNodeEnv);
});

function requestWithHeaders(headers: HeadersInit = {}, cookies: Array<{ name: string; value: string }> = []) {
  const request = new NextRequest("https://example.test/api/protected", { headers });
  Object.defineProperty(request, "cookies", {
    value: { getAll: () => cookies },
  });
  return request;
}

describe("server authentication boundaries", () => {
  it("ignores Authorization and x-appwrite-jwt when no application cookie exists", async () => {
    const { createSessionClient } = await import("@/lib/auth.server");
    const request = requestWithHeaders({
      Authorization: "Bearer valid-looking-token",
      "x-appwrite-jwt": "another-valid-looking-token",
    });
    await expect(createSessionClient(request)).resolves.toBeNull();
  });

  it("uses the application cookie as an Appwrite session, not as a JWT", async () => {
    const { createSessionClient, AUTH_SESSION_COOKIE_NAME } = await import("@/lib/auth.server");
    const request = requestWithHeaders({}, [{ name: AUTH_SESSION_COOKIE_NAME, value: "session-secret" }]);
    const client = await createSessionClient(request);
    expect(client).not.toBeNull();
    expect(client?.client.getHeaders()["X-Appwrite-Session"]).toBe("session-secret");
    expect(client?.client.getHeaders()["X-Appwrite-JWT"]).toBeUndefined();
  });

  it("rejects malformed and wrong-project legacy fallback values", async () => {
    const { extractLegacySessionSecret } = await import("@/lib/auth.server");
    expect(extractLegacySessionSecret("not-json")).toBeNull();
    expect(extractLegacySessionSecret(JSON.stringify({ a_session_other: "secret-secret-secret" }))).toBeNull();
    expect(extractLegacySessionSecret(JSON.stringify({}))).toBeNull();
  });

  it("sets an HttpOnly host-only cookie in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { setAuthSessionCookie, AUTH_SESSION_COOKIE_NAME } = await import("@/lib/auth.server");
    const response = NextResponse.json({ ok: true });
    setAuthSessionCookie(response, "session-secret");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(AUTH_SESSION_COOKIE_NAME).toBe("__Host-linkflow-session");
    expect(setCookie).toContain("__Host-linkflow-session=session-secret");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("secure");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
    expect(setCookie.toLowerCase()).toContain("path=/");
    expect(setCookie.toLowerCase()).not.toContain("domain=");
  });
});
