import { describe, it, expect } from "vitest";
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
