import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  extractEmailFromText,
  rememberEmail,
  getLastKnownEmail,
  clearEmailHint,
} from "@/lib/email-hint";

describe("email-hint — extração e persistência do último email", () => {
  beforeEach(() => {
    clearEmailHint();
  });

  afterEach(() => {
    clearEmailHint();
  });

  it("extrai um email de um texto arbitrário", () => {
    expect(extractEmailFromText("Contact: joao@example.com hoje")).toBe("joao@example.com");
    expect(extractEmailFromText("sem email aqui")).toBeNull();
    expect(extractEmailFromText(null)).toBeNull();
    expect(extractEmailFromText(undefined)).toBeNull();
    expect(extractEmailFromText("")).toBeNull();
  });

  it("guarda e recupera o email em localStorage", () => {
    rememberEmail("ana@exemplo.com");
    expect(getLastKnownEmail()).toBe("ana@exemplo.com");
  });

  it("ignora valores vazios ou não-email ao guardar", () => {
    rememberEmail("");
    expect(getLastKnownEmail()).toBe("");
    rememberEmail("   ");
    expect(getLastKnownEmail()).toBe("");
    rememberEmail("nao-e-email");
    expect(getLastKnownEmail()).toBe("");
  });

  it("normaliza o email extraído de um texto com ruído", () => {
    rememberEmail("   user@exemplo.com   mais texto");
    expect(getLastKnownEmail()).toBe("user@exemplo.com");
  });

  it("limpa o email com clearEmailHint", () => {
    rememberEmail("ana@exemplo.com");
    clearEmailHint();
    expect(getLastKnownEmail()).toBe("");
  });
});
