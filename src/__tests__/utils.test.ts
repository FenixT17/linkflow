import { describe, it, expect } from "vitest";
import { cn, escapeCsv } from "@/lib/utils";

describe("cn (className utility)", () => {
  it("merges class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("resolves tailwind conflicts", () => {
    // twMerge should resolve px-4 over px-2 when both are present
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("handles undefined and null", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });

  it("accepts array arguments", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });
});

describe("escapeCsv (proteção contra formula injection)", () => {
  it("deixa valores normais intactos", () => {
    expect(escapeCsv("Link normal")).toBe("Link normal");
    expect(escapeCsv(42)).toBe("42");
  });

  it("neutraliza fórmulas que começam com = (OWASP)", () => {
    // O valor é prefixado com ' (neutralização) E citado por conter aspas.
    // Quando citado, o ' fica imediatamente após a aspa de abertura: "'...".
    const result = escapeCsv("=HYPERLINK(\"http://evil.com\",\"click\")");
    expect(result).toMatch(/^"?'/); // neutralizado (após citação opcional)
    expect(result).toContain("HYPERLINK");
    expect(result).not.toMatch(/^[=+@]/);
  });

  it("neutraliza fórmulas que começam com + - e @", () => {
    expect(escapeCsv("+2+3")).toBe("'+2+3");
    expect(escapeCsv("-2+3")).toBe("'-2+3");
    expect(escapeCsv("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
  });

  it("cita campos com vírgula, aspas ou linha nova", () => {
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv('a"b')).toBe('"a""b"');
    expect(escapeCsv("a\nb")).toBe('"a\nb"');
  });

  it("aplicação combinada: valor com vírgula que começa por = é neutralizado e citado", () => {
    const result = escapeCsv("=SUM(A1),x");
    expect(result).toMatch(/^"?'/); // neutralizado (após citação opcional)
    expect(result).toContain("SUM(A1)");
  });

  it("neutraliza fórmulas com espaço inicial (Excel faz trim ao parsear)", () => {
    const result = escapeCsv("  =SUM(A1:A2)");
    expect(result).toMatch(/^"?'/); // neutralizado apesar do espaço inicial
    expect(result).toContain("SUM(A1:A2)");
  });
});
