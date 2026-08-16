import { describe, expect, it } from "vitest";
import { isLinkPublicAt, isPublicAt } from "@/lib/page-publication";
import { updateDailyStats } from "@/lib/analytics";

const NOW = Date.parse("2026-08-15T12:00:00.000Z");

describe("page publication", () => {
  it("não publica uma página antes do agendamento", () => {
    expect(isPublicAt({ published: false, scheduledPublishAt: "2026-08-15T13:00:00.000Z" }, NOW)).toBe(false);
  });

  it("publica uma página quando o agendamento chega", () => {
    expect(isPublicAt({ published: false, scheduledPublishAt: "2026-08-15T11:00:00.000Z" }, NOW)).toBe(true);
  });

  it("despublica uma página no momento agendado", () => {
    expect(isPublicAt({ published: true, scheduledUnpublishAt: "2026-08-15T11:00:00.000Z" }, NOW)).toBe(false);
  });

  it("não publica páginas marcadas para eliminação", () => {
    expect(isPublicAt({ published: true, deleting: true }, NOW)).toBe(false);
  });

  it("filtra links agendados para o futuro", () => {
    expect(isLinkPublicAt("2026-08-15T13:00:00.000Z", NOW)).toBe(false);
    expect(isLinkPublicAt("2026-08-15T11:00:00.000Z", NOW)).toBe(true);
    expect(isLinkPublicAt(undefined, NOW)).toBe(true);
  });
});

describe("analytics daily stats", () => {
  it("mantém no máximo 90 dias e não altera o array original", () => {
    const history = Array.from({ length: 100 }, (_, index) => ({
      day: `2026-${String(Math.floor(index / 31) + 1).padStart(2, "0")}-${String((index % 31) + 1).padStart(2, "0")}`,
      views: 1,
      clicks: 0,
    }));
    const result = updateDailyStats(history, "views");

    expect(history).toHaveLength(100);
    expect(result.length).toBeLessThanOrEqual(90);
  });
});
