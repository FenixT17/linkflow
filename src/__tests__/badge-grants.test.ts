import { describe, expect, it } from "vitest";
import { decideBadgeGrant, normalizePersistedBadges } from "@/lib/badge-grants";
import { BADGES } from "@/lib/badges";

const freePlan = { plan: "free", staffApproved: false };

describe("badge grants — regras de desbloqueio", () => {
  it("permite as badges de doação em self-service", () => {
    expect(decideBadgeGrant("verified", freePlan)).toEqual({ allowed: true, persist: true });
    expect(decideBadgeGrant("supporter", freePlan)).toEqual({ allowed: true, persist: true });
  });

  it("nega as badges exclusivas da equipa", () => {
    for (const badgeId of ["early", "partner"]) {
      const decision = decideBadgeGrant(badgeId, { plan: "business", staffApproved: true });
      expect(decision.allowed).toBe(false);
    }
  });

  it("exige plano pago para a badge pro", () => {
    expect(decideBadgeGrant("pro", freePlan).allowed).toBe(false);
    for (const plan of ["pro", "business", "enterprise"]) {
      expect(decideBadgeGrant("pro", { plan, staffApproved: false })).toEqual({
        allowed: true,
        persist: true,
      });
    }
  });

  it("exige candidatura aprovada para a badge staff e nunca a persiste", () => {
    expect(decideBadgeGrant("staff", freePlan).allowed).toBe(false);
    // Aprovada → permitido, mas `persist: false` (a badge é derivada no
    // servidor da candidatura; `pages.emblemas` é editável pelo utilizador).
    expect(decideBadgeGrant("staff", { plan: "free", staffApproved: true })).toEqual({
      allowed: true,
      persist: false,
    });
  });

  it("rejeita ids desconhecidos e valores não-string", () => {
    expect(decideBadgeGrant("admin", freePlan).allowed).toBe(false);
    expect(decideBadgeGrant("", freePlan).allowed).toBe(false);
    expect(decideBadgeGrant(undefined, freePlan).allowed).toBe(false);
    expect(decideBadgeGrant(42, freePlan).allowed).toBe(false);
    expect(decideBadgeGrant(["verified"], freePlan).allowed).toBe(false);
  });

  it("cobre todas as badges do registo (nenhuma fica sem regra)", () => {
    for (const badge of BADGES) {
      const decision = decideBadgeGrant(badge.id, { plan: "business", staffApproved: true });
      // Com plano pago e candidatura aprovada, o que resta é a regra de equipa.
      const expectedAllowed = badge.unlock !== "team";
      expect(decision.allowed).toBe(expectedAllowed);
    }
  });
});

describe("normalizePersistedBadges", () => {
  it("descarta ids desconhecidos e duplicados", () => {
    expect(normalizePersistedBadges(["verified", "verified", "admin", "supporter"])).toEqual([
      "verified",
      "supporter",
    ]);
  });

  it("remove sempre a badge staff do documento editável", () => {
    expect(normalizePersistedBadges(["staff", "verified"])).toEqual(["verified"]);
    // sozinha: staff nunca é aceite de `pages`
    expect(normalizePersistedBadges(["staff"])).toEqual([]);
  });

  it("tolera valores não-array e entradas não-string", () => {
    expect(normalizePersistedBadges(null)).toEqual([]);
    expect(normalizePersistedBadges(undefined)).toEqual([]);
    expect(normalizePersistedBadges("verified")).toEqual([]);
    expect(normalizePersistedBadges([1, true, null, "pro"])).toEqual(["pro"]);
  });
});
