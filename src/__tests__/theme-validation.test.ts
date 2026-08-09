import { describe, expect, it } from "vitest";
import { isSafeThemeColor, isSafeThemeFont, validateThemePayload } from "@/lib/theme-validation";

describe("theme validation", () => {
  it("accepts bounded hex, RGB and HSL values", () => {
    expect(isSafeThemeColor("#fff")).toBe(true);
    expect(isSafeThemeColor("rgba(255, 255, 255, 0.4)")).toBe(true);
    expect(isSafeThemeColor("hsl(220, 20%, 40%)")).toBe(true);
  });

  it("rejects CSS injection and out-of-range channels", () => {
    expect(isSafeThemeColor("url(javascript:alert(1))")).toBe(false);
    expect(isSafeThemeColor("rgb(999, 0, 0)")).toBe(false);
    expect(isSafeThemeColor("hsl(400, 20%, 40%)")).toBe(false);
    expect(validateThemePayload({ backgroundColor: "red; background:url(x)" })).toContain("backgroundColor");
  });

  it("accepts only the font whitelist", () => {
    expect(isSafeThemeFont("Inter")).toBe(true);
    expect(isSafeThemeFont("Arial")).toBe(true);
    expect(isSafeThemeFont("system-ui; color:red")).toBe(false);
  });
});
