import { describe, expect, it } from "vitest";
import { isStaffApplicationApproved, normalizeStaffApplicationMessage } from "@/lib/staff-security";

describe("staff application security", () => {
  it("requires a meaningful application message", () => {
    expect(() => normalizeStaffApplicationMessage("too short")).toThrow(/mín. 20/);
    expect(normalizeStaffApplicationMessage("  Esta é uma candidatura suficientemente detalhada.  "))
      .toBe("Esta é uma candidatura suficientemente detalhada.");
  });

  it("requires a trusted reviewer before staff approval is accepted", () => {
    expect(isStaffApplicationApproved({ estado: "approved" })).toBe(false);
    expect(isStaffApplicationApproved({ estado: "approved", revistoPor: "" })).toBe(false);
    expect(isStaffApplicationApproved({ estado: "approved", revistoPor: "team-admin" })).toBe(true);
    expect(isStaffApplicationApproved({ estado: "pending", revistoPor: "team-admin" })).toBe(false);
  });
});
