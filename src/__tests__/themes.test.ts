import { describe, it, expect } from "vitest";
import { getLiquidGlassClasses } from "@/lib/themes";

describe("getLiquidGlassClasses", () => {
  it("returns all required CSS classes", () => {
    const classes = getLiquidGlassClasses();
    const requiredProps = [
      "backgroundClass", "cardClass", "linkClass",
      "linkHoverClass", "linkIconClass", "titleClass",
      "bioClass", "usernameClass", "buttonClass", "footerClass",
    ];

    for (const prop of requiredProps) {
      expect(classes).toHaveProperty(prop);
      expect(typeof (classes as unknown as Record<string, string>)[prop]).toBe("string");
    }
  });

  it("returns only Liquid Glass classes (no theme-specific classes)", () => {
    const classes = getLiquidGlassClasses();
    // No theme-specific color classes
    expect(classes.linkClass).not.toContain("text-amber");
    expect(classes.linkClass).not.toContain("text-cyan");
    expect(classes.linkClass).not.toContain("text-violet");
    expect(classes.linkClass).not.toContain("text-fuchsia");
    // Uses CSS variables instead
    expect(classes.linkClass).toContain("var(--foreground)");
  });

  it("contains glass-card and glass-shadow in cardClass", () => {
    const classes = getLiquidGlassClasses();
    expect(classes.cardClass).toContain("glass-card");
    expect(classes.cardClass).toContain("glass-shadow");
  });

  it("contains glass-btn in buttonClass", () => {
    const classes = getLiquidGlassClasses();
    expect(classes.buttonClass).toContain("glass-btn");
  });

  it("is deterministic (same result every call)", () => {
    const a = getLiquidGlassClasses();
    const b = getLiquidGlassClasses();
    expect(a).toEqual(b);
  });
});
