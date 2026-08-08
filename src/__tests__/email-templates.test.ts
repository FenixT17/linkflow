import { describe, expect, it, vi } from "vitest";
import {
  escapeEmailHtml,
  renderMailerSendVerificationEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
} from "@/lib/email-templates";

describe("email templates", () => {
  it("escapes user-controlled names in HTML while keeping text readable", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://linkflow.workers.dev");
    try {
      const content = renderVerificationEmail(
        { name: "<script>alert('xss')</script>" },
        "https://linkflow.workers.dev/verify?token=abc"
      );

      expect(content.html).not.toContain("<script>alert");
      expect(content.html).toContain("&lt;script&gt;");
      expect(content.text).toContain("<script>alert('xss')</script>");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("falls back to the workers.dev origin when NEXT_PUBLIC_SITE_URL is empty (CI without secrets)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    try {
      const content = renderVerificationEmail(
        { name: "Ana" },
        "https://linkflow.workers.dev/verify?token=abc"
      );
      expect(content.subject).toBe("Confirme o seu email — LinkFlow");
      expect(content.html).toContain("https://linkflow.workers.dev/verify?token=abc");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("renders verification subject, action and fallback URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    const content = renderVerificationEmail(
      { name: "Ana" },
      "https://example.com/verify?token=abc"
    );
    vi.unstubAllEnvs();

    expect(content.subject).toBe("Confirme o seu email — LinkFlow");
    expect(content.html).toContain("Confirmar email");
    expect(content.html).toContain("https://example.com/verify?token=abc");
    expect(content.text).toContain("https://example.com/verify?token=abc");
  });

  it("MailerSend verification: subject, button, fallback link and PT-PT copy", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://linkflow.example");
    const content = renderMailerSendVerificationEmail(
      { name: "Ana" },
      "https://linkflow.example/verify-email?userId=u1&token=abc123"
    );
    vi.unstubAllEnvs();

    expect(content.subject).toBe("Confirma o teu email — LinkFlow");
    expect(content.html).toContain("Confirmar email");
    expect(content.html).toContain("Bem-vindo ao LinkFlow, Ana.");
    expect(content.html).toContain(
      "https://linkflow.example/verify-email?userId=u1&amp;token=abc123"
    );
    expect(content.html).toContain("Se não foste tu que criaste esta conta");
    expect(content.text).toContain("https://linkflow.example/verify-email?userId=u1&token=abc123");
    expect(content.text).toContain("podes ignorar este email");
  });

  it("MailerSend verification: escapes user-controlled names (no HTML injection)", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://linkflow.example");
    try {
      const content = renderMailerSendVerificationEmail(
        { name: "<script>alert(1)</script>" },
        "https://linkflow.example/verify-email?userId=u1&token=abc"
      );
      expect(content.html).not.toContain("<script>alert");
      expect(content.html).toContain("&lt;script&gt;");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("MailerSend verification: rejects URLs outside the configured site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://linkflow.example");
    try {
      expect(() =>
        renderMailerSendVerificationEmail({}, "https://attacker.example/verify")
      ).toThrow("O endereço da ação do email não pertence ao LinkFlow.");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("renders password reset content with the safety notice", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    const content = renderPasswordResetEmail(
      { name: "Rui" },
      "https://example.com/reset?token=abc"
    );
    vi.unstubAllEnvs();

    expect(content.subject).toBe("Redefina a sua palavra-passe — LinkFlow");
    expect(content.html).toContain("Redefinir palavra-passe");
    expect(content.text).toContain("Se não fez este pedido");
  });

  it("rejects non-HTTP(S) action URLs", () => {
    expect(() => renderVerificationEmail({}, "javascript:alert(1)")).toThrow(
      "O endereço da ação do email deve usar HTTP(S)."
    );
  });

  it("rejects action URLs outside the configured site origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://linkflow.example");
    try {
      expect(() => renderVerificationEmail({}, "https://attacker.example/verify")).toThrow(
        "O endereço da ação do email não pertence ao LinkFlow."
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("requires HTTPS action URLs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => renderVerificationEmail({}, "http://example.com/verify")).toThrow(
        "O endereço da ação do email deve usar HTTPS em produção."
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("escapes all HTML-sensitive characters", () => {
    expect(escapeEmailHtml(`& < > \" '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });
});
