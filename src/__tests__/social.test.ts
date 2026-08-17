import { describe, it, expect } from "vitest";
import {
  buildSocialUrl,
  searchSocialPlatforms,
  getSocialPlatforms,
} from "@/lib/social";

describe("buildSocialUrl — nomeUtilizador → URL auto-generation", () => {
  it("generates Instagram URL from nomeUtilizador", () => {
    const result = buildSocialUrl("instagram", "joao");
    expect(result.url).toBe("https://instagram.com/joao");
    expect(result.nomeUtilizador).toBe("joao");
    expect(result.error).toBeUndefined();
  });

  it("generates GitHub URL from nomeUtilizador", () => {
    const result = buildSocialUrl("github", "octocat");
    expect(result.url).toBe("https://github.com/octocat");
    expect(result.nomeUtilizador).toBe("octocat");
  });

  it("generates Telegram URL from nomeUtilizador", () => {
    const result = buildSocialUrl("telegram", "joao");
    expect(result.url).toBe("https://t.me/joao");
    expect(result.nomeUtilizador).toBe("joao");
  });

  it("handles leading @ in usernames", () => {
    const result = buildSocialUrl("tiktok", "@joao");
    expect(result.url).toBe("https://tiktok.com/@joao");
    expect(result.nomeUtilizador).toBe("joao");
  });

  it("trims whitespace and sanitizes unsafe chars in usernames", () => {
    const result = buildSocialUrl("instagram", "  joao_silva  ");
    expect(result.url).toBe("https://instagram.com/joao_silva");
  });

  it("generates mailto: for email from a bare address", () => {
    const result = buildSocialUrl("email", "ola@exemplo.com");
    expect(result.url).toBe("mailto:ola@exemplo.com");
    expect(result.nomeUtilizador).toBe("ola@exemplo.com");
  });

  it("rejects invalid emails", () => {
    const result = buildSocialUrl("email", "nao-e-um-email");
    expect(result.url).toBe("");
    expect(result.error).toBeTruthy();
  });

  it("requires full URL for platforms without auto-generation", () => {
    const result = buildSocialUrl("website", "meusite");
    expect(result.url).toBe("");
    expect(result.error).toContain("URL completa");
  });
});

describe("buildSocialUrl — full URL passthrough and validation", () => {
  it("accepts a valid platform URL exactly as provided", () => {
    const result = buildSocialUrl("instagram", "https://instagram.com/joao.silva");
    expect(result.url).toBe("https://instagram.com/joao.silva");
  });

  it("rejects a full URL from a different host", () => {
    const result = buildSocialUrl("github", "https://example.com/octocat");
    expect(result.url).toBe("");
    expect(result.error).toContain("URL inválida");
  });

  it("blocks javascript: protocol", () => {
    const result = buildSocialUrl("instagram", "javascript:alert(1)");
    expect(result.url).toBe("");
    expect(result.error).toBe("Protocolo não permitido.");
  });

  it("blocks data: protocol", () => {
    const result = buildSocialUrl("website", "data:text/html,<script>alert(1)</script>");
    expect(result.url).toBe("");
  });

  it("blocks vbscript:, file: and blob: protocols", () => {
    expect(buildSocialUrl("website", "vbscript:msgbox(1)").url).toBe("");
    expect(buildSocialUrl("website", "file:///etc/passwd").url).toBe("");
    expect(buildSocialUrl("website", "blob:https://example.com").url).toBe("");
  });

  it("rejects http:// (HTTPS only) for external platforms", () => {
    const result = buildSocialUrl("instagram", "http://instagram.com/joao");
    expect(result.url).toBe("");
    expect(result.error).toContain("HTTPS");
  });

  it("rejects malformed URLs", () => {
    const result = buildSocialUrl("website", "https://");
    expect(result.url).toBe("");
    expect(result.error).toBeTruthy();
  });

  it("only allows mailto: for email platform", () => {
    expect(buildSocialUrl("instagram", "mailto:x@y.com").url).toBe("");
    expect(buildSocialUrl("email", "mailto:ola@exemplo.com").url).toBe("mailto:ola@exemplo.com");
  });

  it("blocks whitespace/empty inputs", () => {
    expect(buildSocialUrl("github", "").url).toBe("");
    expect(buildSocialUrl("github", "   ").url).toBe("");
  });

  it("accepts tel: only for WhatsApp", () => {
    const result = buildSocialUrl("whatsapp", "tel:+351912345678");
    expect(result.url).toBe("tel:+351912345678");
    expect(result.nomeUtilizador).toBe("+351912345678");
  });

  it("rejects tel: for non-phone platforms", () => {
    expect(buildSocialUrl("instagram", "tel:+351912345678").url).toBe("");
    expect(buildSocialUrl("website", "tel:123").url).toBe("");
  });

  it("rejects malformed WhatsApp phone numbers", () => {
    expect(buildSocialUrl("whatsapp", "tel:123").url).toBe("");
    expect(buildSocialUrl("whatsapp", "tel:abc").url).toBe("");
  });
});

describe("platform catalog", () => {
  it("exposes all required platforms in the social section", () => {
    const ids = getSocialPlatforms().map((p) => p.id);
    for (const required of [
      "instagram",
      "facebook",
      "x",
      "tiktok",
      "youtube",
      "linkedin",
      "github",
      "gitlab",
      "discord",
      "telegram",
      "whatsapp",
      "threads",
      "bluesky",
      "reddit",
      "pinterest",
      "snapchat",
      "twitch",
      "kick",
      "steam",
      "spotify",
      "soundcloud",
      "applemusic",
      "deezer",
      "bandcamp",
      "medium",
      "substack",
      "behance",
      "dribbble",
      "figma",
      "codepen",
      "devto",
      "hashnode",
      "mastodon",
      "patreon",
      "kofi",
      "buymeacoffee",
      "onlyfans",
      "trello",
      "notion",
      "calendly",
      "email",
      "website",
      "portfolio",
      "blog",
    ]) {
      expect(ids).toContain(required);
    }
  });

  it("searches platforms by name and keywords", () => {
    expect(searchSocialPlatforms("insta").some((p) => p.id === "instagram")).toBe(true);
    expect(searchSocialPlatforms("ko fi").some((p) => p.id === "kofi")).toBe(true);
    expect(searchSocialPlatforms("zzzz").length).toBe(0);
    expect(searchSocialPlatforms("").length).toBeGreaterThan(0);
  });
});
