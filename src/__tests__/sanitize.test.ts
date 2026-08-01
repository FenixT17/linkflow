import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  sanitizeUrl,
  sanitizeUsername,
  sanitizeDisplayName,
  sanitizeBio,
  isValidEmail,
  isValidPassword,
  sanitizeSocialLinks,
  detectSuspiciousInput,
  hashForLog,
} from "@/lib/sanitize";

describe("sanitizeText", () => {
  it("escapes HTML tags", () => {
    expect(sanitizeText("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
    );
  });

  it("escapes double quotes", () => {
    expect(sanitizeText('he said "hello"')).toBe("he said &quot;hello&quot;");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeText("")).toBe("");
  });

  it("preserves safe text", () => {
    expect(sanitizeText("Hello, world!")).toBe("Hello, world!");
    expect(sanitizeText("Olá, como estás?")).toBe("Olá, como estás?");
  });
});

describe("sanitizeUrl", () => {
  it("allows https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("allows http URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto URLs", () => {
    expect(sanitizeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
  });

  it("allows tel URLs", () => {
    expect(sanitizeUrl("tel:+123456789")).toBe("tel:+123456789");
  });

  it("blocks javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl("JavaScript:alert(1)")).toBe("");
  });

  it("blocks data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  it("allows relative paths", () => {
    expect(sanitizeUrl("/profile")).toBe("/profile");
    expect(sanitizeUrl("#section")).toBe("#section");
  });

  it("returns empty for invalid input", () => {
    expect(sanitizeUrl("")).toBe("");
    expect(sanitizeUrl(null as unknown as string)).toBe("");
  });
});

describe("sanitizeUsername", () => {
  it("lowercases and removes special chars", () => {
    expect(sanitizeUsername("John Doe!")).toBe("johndoe");
    expect(sanitizeUsername("User_Name")).toBe("user_name");
    expect(sanitizeUsername("ABC123")).toBe("abc123");
  });

  it("trims whitespace", () => {
    expect(sanitizeUsername("  hello  ")).toBe("hello");
  });

  it("returns empty for empty input", () => {
    expect(sanitizeUsername("")).toBe("");
  });
});

describe("sanitizeDisplayName", () => {
  it("removes HTML tags", () => {
    expect(sanitizeDisplayName("<script>alert</script>John")).toBe("alertJohn");
  });

  it("trims whitespace", () => {
    expect(sanitizeDisplayName("  John Doe  ")).toBe("John Doe");
  });

  it("preserves accented characters", () => {
    expect(sanitizeDisplayName("João Silva")).toBe("João Silva");
  });

  it("limits to 255 characters", () => {
    const longName = "a".repeat(300);
    expect(sanitizeDisplayName(longName).length).toBe(255);
  });
});

describe("sanitizeBio", () => {
  it("removes HTML tags", () => {
    expect(sanitizeBio("<p>Hello</p>")).toBe("Hello");
    expect(sanitizeBio("<script>evil</script>bio")).toBe("evilbio");
  });

  it("removes content inside angle brackets", () => {
    // < b and c > is treated as an HTML tag and removed entirely
    expect(sanitizeBio("a < b and c > d")).toBe("a  d");
  });

  it("removes script tags but keeps content", () => {
    // sanitizeBio only strips tags (<...>), not the content between them
    expect(sanitizeBio("Hello <script>evil</script> world")).toBe("Hello evil world");
  });

  it("limits to 4096 characters", () => {
    const longBio = "x".repeat(5000);
    expect(sanitizeBio(longBio).length).toBe(4096);
  });
});

describe("isValidEmail", () => {
  it("validates correct emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@example.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("accepts strong passwords (12+ chars, upper, lower, digit, symbol)", () => {
    expect(isValidPassword("Abcdefghij12!")).toBe(true);
    expect(isValidPassword("P4ssw0rdLong!")).toBe(true);
    expect(isValidPassword("Secure#Passw0rd99")).toBe(true);
  });

  it("rejects short passwords", () => {
    expect(isValidPassword("Ab1")).toBe(false);
    expect(isValidPassword("Abcdef12!")).toBe(false); // 9 chars
    expect(isValidPassword("")).toBe(false);
  });

  it("rejects passwords without uppercase", () => {
    expect(isValidPassword("abcdefghij12!")).toBe(false);
  });

  it("rejects passwords without lowercase", () => {
    expect(isValidPassword("ABCDEFGHIJ12!")).toBe(false);
  });

  it("rejects passwords without digits", () => {
    expect(isValidPassword("Abcdefghijkl!")).toBe(false);
  });

  it("rejects passwords without a symbol", () => {
    expect(isValidPassword("Abcdefghij12")).toBe(false);
  });
});

describe("sanitizeSocialLinks", () => {
  it("sanitizes social URLs", () => {
    const social = {
      instagram: "https://instagram.com/user",
      twitter: "javascript:alert(1)",
    };
    const result = sanitizeSocialLinks(social);
    expect(result.instagram).toBe("https://instagram.com/user");
    expect(result.twitter).toBe("");
  });

  it("handles empty input", () => {
    expect(sanitizeSocialLinks({})).toEqual({});
  });

  it("filters out non-string values", () => {
    const social = {
      instagram: "https://instagram.com/user",
      youtube: undefined,
    };
    const result = sanitizeSocialLinks(social);
    expect(result.instagram).toBe("https://instagram.com/user");
    expect(result.youtube).toBeUndefined();
  });
});

describe("detectSuspiciousInput", () => {
  it("detects script tags", () => {
    const result = detectSuspiciousInput("<script>alert(1)</script>");
    expect(result.suspicious).toBe(true);
    expect(result.matchedPatterns.length).toBeGreaterThan(0);
  });

  it("detects event handlers", () => {
    const result = detectSuspiciousInput('<div onload="evil()">');
    expect(result.suspicious).toBe(true);
  });

  it("detects javascript: URIs", () => {
    const result = detectSuspiciousInput("javascript:alert(1)");
    expect(result.suspicious).toBe(true);
  });

  it("detects eval usage", () => {
    const result = detectSuspiciousInput("eval(something)");
    expect(result.suspicious).toBe(true);
  });

  it("returns safe for normal input", () => {
    const result = detectSuspiciousInput("Hello, this is a normal message!");
    expect(result.suspicious).toBe(false);
    expect(result.matchedPatterns).toEqual([]);
  });

  it("handles empty input", () => {
    const result = detectSuspiciousInput("");
    expect(result.suspicious).toBe(false);
  });
});

describe("hashForLog", () => {
  it("returns a 64-char hex string", async () => {
    const hash = await hashForLog("test@example.com");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("is deterministic (same input = same output)", async () => {
    const hash1 = await hashForLog("user@test.com");
    const hash2 = await hashForLog("user@test.com");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await hashForLog("alice@test.com");
    const hash2 = await hashForLog("bob@test.com");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", async () => {
    const hash = await hashForLog("");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });
});
