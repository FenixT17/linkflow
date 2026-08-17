import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ALLOWED_THEMES,
  FALLBACK_THEME,
  getSafeTheme,
  getSafeThemeFromStorage,
  isAllowedTheme,
  sanitizeStoredTheme,
  THEME_SANITIZER_SCRIPT,
  THEME_STORAGE_KEY,
} from "@/lib/theme-security";
import { renderJsonLd } from "@/lib/seo";

describe("theme security — whitelist", () => {
  it("whitelist contém exatamente light, dark, gray e system", () => {
    expect([...ALLOWED_THEMES]).toEqual(["light", "dark", "gray", "system"]);
    expect(FALLBACK_THEME).toBe("system");
    expect(THEME_STORAGE_KEY).toBe("theme");
  });

  it("isAllowedTheme aceita apenas valores da whitelist", () => {
    expect(isAllowedTheme("light")).toBe(true);
    expect(isAllowedTheme("dark")).toBe(true);
    expect(isAllowedTheme("gray")).toBe(true);
    expect(isAllowedTheme("system")).toBe(true);
    expect(isAllowedTheme("blue")).toBe(false);
    expect(isAllowedTheme('"><img src=x onerror=alert(1)>')).toBe(false);
    expect(isAllowedTheme("")).toBe(false);
    expect(isAllowedTheme(null)).toBe(false);
    expect(isAllowedTheme(undefined)).toBe(false);
    expect(isAllowedTheme(123)).toBe(false);
  });

  it("getSafeTheme devolve sempre um valor da whitelist", () => {
    expect(getSafeTheme("light")).toBe("light");
    expect(getSafeTheme("dark")).toBe("dark");
    expect(getSafeTheme("gray")).toBe("gray");
    expect(getSafeTheme("system")).toBe("system");
    // Valores inválidos → fallback "system"
    expect(getSafeTheme('"><script>alert(1)</script>')).toBe("system");
    expect(getSafeTheme("dark-mode")).toBe("system");
    expect(getSafeTheme(null)).toBe("system");
    expect(getSafeTheme(undefined)).toBe("system");
    expect(getSafeTheme(42 as unknown)).toBe("system");
  });
});

describe("theme security — localStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("getSafeThemeFromStorage lê e valida localStorage", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(getSafeThemeFromStorage()).toBe("dark");
  });

  it("getSafeThemeFromStorage devolve system para valor inválido", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      '"><svg onload=alert(document.domain)>'
    );
    expect(getSafeThemeFromStorage()).toBe("system");
  });

  it("getSafeThemeFromStorage devolve system quando a chave não existe", () => {
    expect(getSafeThemeFromStorage()).toBe("system");
  });

  it("sanitizeStoredTheme corrige valor inválido para system", () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      '"><img src=x onerror=alert(1)>'
    );
    const safe = sanitizeStoredTheme();
    expect(safe).toBe("system");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });

  it("sanitizeStoredTheme mantém valores válidos", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(sanitizeStoredTheme()).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("sanitizeStoredTheme é idempotente", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "hacker");
    sanitizeStoredTheme();
    sanitizeStoredTheme();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("system");
  });
});

describe("theme security — sanitizer script", () => {
  it("o script sanitizador é código puro sem importações", () => {
    expect(THEME_SANITIZER_SCRIPT).toContain('"light"');
    expect(THEME_SANITIZER_SCRIPT).toContain('"dark"');
    expect(THEME_SANITIZER_SCRIPT).toContain('"system"');
    expect(THEME_SANITIZER_SCRIPT).toContain("localStorage");
    expect(THEME_SANITIZER_SCRIPT).not.toContain("import ");
    expect(THEME_SANITIZER_SCRIPT).not.toContain("require(");
  });

  it("o script sanitizador bloqueia escritas inválidas (vetor cross-tab)", () => {
    expect(THEME_SANITIZER_SCRIPT).toContain("Storage.prototype.setItem");
    expect(THEME_SANITIZER_SCRIPT).toContain("FALLBACK");
  });
});

describe("renderJsonLd — escape contra script breakout (CWE-79)", () => {
  it("escapa < e > para impedir </script> breakout", () => {
    const { __html } = renderJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(__html).not.toContain("</script>");
    expect(__html).toContain("\\u003c/script\\u003e");
  });

  it("escapa &, U+2028 e U+2029", () => {
    const { __html } = renderJsonLd({
      text: "a & b \u2028 c \u2029 d",
    });
    expect(__html).not.toContain("&");
    expect(__html).toContain("\\u0026");
    expect(__html).toContain("\\u2028");
    expect(__html).toContain("\\u2029");
  });

  it("produz JSON válido que round-trip preserva o valor original", () => {
    const payload = { name: "João </script>", bio: "a & b" };
    const { __html } = renderJsonLd(payload);
    const parsed = JSON.parse(__html);
    expect(parsed.name).toBe("João </script>");
    expect(parsed.bio).toBe("a & b");
  });

  it("mantém objetos normais intactos", () => {
    const { __html } = renderJsonLd({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "LinkFlow",
    });
    const parsed = JSON.parse(__html);
    expect(parsed["@type"]).toBe("Person");
    expect(parsed.name).toBe("LinkFlow");
  });
});
