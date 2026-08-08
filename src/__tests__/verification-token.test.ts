import { describe, expect, it, vi } from "vitest";
import {
  createVerificationToken,
  hashToken,
  isValidUserId,
  isValidVerificationToken,
  VERIFICATION_TOKEN_TTL_MS,
  verifyTokenMatch,
} from "@/lib/verification.server";

describe("verification token helpers", () => {
  it("generates a high-entropy token with a matching sha256 hash and future expiry", () => {
    const { token, tokenHash, expiresAt } = createVerificationToken();

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(/^[a-zA-Z0-9_-]+$/.test(token)).toBe(true);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    expect(Date.parse(expiresAt)).toBeLessThanOrEqual(
      Date.now() + VERIFICATION_TOKEN_TTL_MS + 5000
    );
  });

  it("hashToken is deterministic", () => {
    expect(hashToken("token-a")).toBe(hashToken("token-a"));
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("verifyTokenMatch accepts a valid unexpired token", () => {
    const { token, tokenHash, expiresAt } = createVerificationToken();
    expect(verifyTokenMatch(token, { hash: tokenHash, expiresAt })).toBe("valid");
  });

  it("verifyTokenMatch rejects wrong tokens and missing state", () => {
    const { token, tokenHash, expiresAt } = createVerificationToken();
    expect(verifyTokenMatch("outro-token-12345678901234567890", { hash: tokenHash, expiresAt })).toBe("invalid");
    expect(verifyTokenMatch(token, null)).toBe("missing");
    expect(verifyTokenMatch(token, {})).toBe("missing");
  });

  it("verifyTokenMatch rejects expired tokens", () => {
    const { token, tokenHash } = createVerificationToken();
    const past = new Date(Date.now() - 1000).toISOString();
    expect(verifyTokenMatch(token, { hash: tokenHash, expiresAt: past })).toBe("expired");
  });

  it("validates userId and token shapes (defence-in-depth on the confirm route)", () => {
    expect(isValidUserId("u123_abc.-")).toBe(true);
    expect(isValidUserId("u1".repeat(20))).toBe(false); // > 36 chars
    expect(isValidUserId("bad user!")).toBe(false);

    const { token } = createVerificationToken();
    expect(isValidVerificationToken(token)).toBe(true);
    expect(isValidVerificationToken("short")).toBe(false);
    expect(isValidVerificationToken("token with spaces and !!!")).toBe(false);
  });
});

// Garante que o módulo não depende de valores reais de ambiente para os
// helpers puros (o resto do módulo só os usa dentro de funções de rede).
describe("verification module env safety", () => {
  it("pure helpers work without any environment variables", () => {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", "");
    vi.stubEnv("APPWRITE_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    try {
      const { token, tokenHash, expiresAt } = createVerificationToken();
      expect(verifyTokenMatch(token, { hash: tokenHash, expiresAt })).toBe("valid");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
