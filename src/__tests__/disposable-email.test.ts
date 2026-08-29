import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "@/lib/disposable-email";

describe("isDisposableEmail", () => {
  it("bloqueia os provedores temporários indicados", () => {
    const domains = [
      "mailinator.com",
      "10minutemail.com",
      "guerrillamail.com",
      "tempmail.com",
      "temp-mail.org",
      "yopmail.com",
      "sharklasers.com",
      "guerrillamail.net",
      "getnada.com",
      "maildrop.cc",
      "grr.la",
      "33mail.com",
      "mail7.io",
      "monmail.fr.nf",
      "tempmail.net",
      "guerrillamail.biz",
      "incognitomail.com",
      "disposable-mail.com",
      "nospam.ze.tc",
      "deixa.me",
    ];

    for (const domain of domains) {
      expect(isDisposableEmail(`User@${domain}`)).toBe(true);
    }
  });

  it("bloqueia subdomínios e variações de capitalização", () => {
    expect(isDisposableEmail("user@SUB.Mailinator.com")).toBe(true);
    expect(isDisposableEmail("user@temp-mail.io.")).toBe(true);
  });

  it("não bloqueia provedores normais", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
    expect(isDisposableEmail("user@outlook.com")).toBe(false);
    expect(isDisposableEmail("user@empresa.pt")).toBe(false);
  });

  it("não classifica emails sem domínio como descartáveis", () => {
    expect(isDisposableEmail("invalid-email")).toBe(false);
  });
});
