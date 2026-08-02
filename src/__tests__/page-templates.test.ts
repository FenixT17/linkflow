import { describe, it, expect } from "vitest";
import {
  PAGE_TEMPLATES,
  PAGE_TEMPLATE_BY_ID,
  DEFAULT_PAGE_TEMPLATE,
  isPageTemplate,
} from "@/lib/page-templates";

describe("page-templates — registro de templates (Sessão 32)", () => {
  it("tem exatamente os 2 templates: template1 e template2", () => {
    const ids = PAGE_TEMPLATES.map((t) => t.id).sort();
    expect(ids).toEqual(["template1", "template2"]);
  });

  it("o template padrão para novos utilizadores é template1", () => {
    expect(DEFAULT_PAGE_TEMPLATE).toBe("template1");
  });

  it("PAGE_TEMPLATE_BY_ID mapeia todos os ids do registro", () => {
    for (const meta of PAGE_TEMPLATES) {
      expect(PAGE_TEMPLATE_BY_ID[meta.id]).toBe(meta);
    }
  });

  it("isPageTemplate aceita apenas valores válidos", () => {
    expect(isPageTemplate("template1")).toBe(true);
    expect(isPageTemplate("template2")).toBe(true);
    expect(isPageTemplate("minimal")).toBe(false);
    expect(isPageTemplate("creator")).toBe(false);
    expect(isPageTemplate(undefined)).toBe(false);
    expect(isPageTemplate(null)).toBe(false);
    expect(isPageTemplate(42)).toBe(false);
  });

  it("cada template tem metadata completa para o dashboard", () => {
    for (const meta of PAGE_TEMPLATES) {
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(meta.thumb).toBe(meta.id);
    }
  });

  it("template1 é neutro e template2 é violeta (accent distinto)", () => {
    const t1 = PAGE_TEMPLATE_BY_ID.template1;
    const t2 = PAGE_TEMPLATE_BY_ID.template2;
    expect(t1.accent).not.toBe(t2.accent);
    expect(t2.accent.toLowerCase()).toBe("#8b5cf6");
  });
});
