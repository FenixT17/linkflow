import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptchaError, verifyHCaptcha } from "@/lib/captcha";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("hCaptcha verification", () => {
  it("fails closed when configuration or token is missing", async () => {
    await expect(verifyHCaptcha(new Request("https://example.test"), "")).rejects.toBeInstanceOf(CaptchaError);
  });

  it("requires an explicit successful provider response", async () => {
    vi.stubEnv("HCAPTCHA_SECRET", "server-secret");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "site-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 200 })));
    await expect(verifyHCaptcha(new Request("https://example.test"), "valid-token-value")).rejects.toBeInstanceOf(CaptchaError);
  });

  it("accepts only a successful provider response", async () => {
    vi.stubEnv("HCAPTCHA_SECRET", "server-secret");
    vi.stubEnv("NEXT_PUBLIC_HCAPTCHA_SITE_KEY", "site-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })));
    await expect(verifyHCaptcha(new Request("https://example.test"), "valid-token-value")).resolves.toBeUndefined();
  });
});
