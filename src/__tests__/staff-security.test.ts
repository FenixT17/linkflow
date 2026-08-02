import { describe, expect, it } from "vitest";
import { isStaffApplicationApproved, normalizeStaffApplicationMessage } from "@/lib/staff-security";

describe("staff application security", () => {
  it("requires a meaningful application message", () => {
    expect(() => normalizeStaffApplicationMessage("too short")).toThrow(/mín. 20/);
    expect(normalizeStaffApplicationMessage("  Esta é uma candidatura suficientemente detalhada.  "))
      .toBe("Esta é uma candidatura suficientemente detalhada.");
  });

  it("requires a trusted reviewer before staff approval is accepted", () => {
    expect(isStaffApplicationApproved({ status: "approved" })).toBe(false);
    expect(isStaffApplicationApproved({ status: "approved", reviewedBy: "" })).toBe(false);
    expect(isStaffApplicationApproved({ status: "approved", reviewedBy: "team-admin" })).toBe(true);
    expect(isStaffApplicationApproved({ status: "pending", reviewedBy: "team-admin" })).toBe(false);
  });
});
