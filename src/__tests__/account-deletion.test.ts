import {
  ACCOUNT_COLLECTIONS,
  PAGE_SCOPED_COLLECTIONS,
  USER_SCOPED_COLLECTIONS,
  USER_SCOPED_OWNER_FIELD,
  collectAnalyticsVisitorHashes,
  fileBelongsToUser,
} from "@/lib/account-deletion";

describe("account deletion inventory", () => {
  it("includes personal, page, analytics, visitor and operational collections", () => {
    // `users` é o perfil da aplicação e deve ser apagado. A identidade Auth
    // (email/nome) vive fora destas coleções e é preservada no Appwrite.
    expect(USER_SCOPED_COLLECTIONS).toEqual(expect.arrayContaining([
      ACCOUNT_COLLECTIONS.users,
      ACCOUNT_COLLECTIONS.activityLogs,
      ACCOUNT_COLLECTIONS.securityLogs,
      ACCOUNT_COLLECTIONS.staffApplications,
    ]));
    expect(PAGE_SCOPED_COLLECTIONS).toEqual(expect.arrayContaining([
      ACCOUNT_COLLECTIONS.links,
      ACCOUNT_COLLECTIONS.analytics,
      ACCOUNT_COLLECTIONS.visits,
    ]));
    expect(ACCOUNT_COLLECTIONS.collectedIps).toBe("collected_ips");
  });

  it("maps the owner field of user-scoped collections (teams uses idProprietario, not idUtilizador)", () => {
    // Regressão da Sessão 43: consultar `idUtilizador` na coleção teams falhava com
    // "Attribute not found in schema: idUtilizador" e abortava a exclusão depois de
    // as páginas já terem sido apagadas.
    expect(USER_SCOPED_OWNER_FIELD[ACCOUNT_COLLECTIONS.teams]).toBe("idProprietario");
    expect(USER_SCOPED_OWNER_FIELD[ACCOUNT_COLLECTIONS.subscriptions]).toBe("idUtilizador");
    expect(USER_SCOPED_OWNER_FIELD[ACCOUNT_COLLECTIONS.notifications]).toBe("idUtilizador");
    expect(USER_SCOPED_OWNER_FIELD[ACCOUNT_COLLECTIONS.activityLogs]).toBe("idUtilizador");
    expect(USER_SCOPED_OWNER_FIELD[ACCOUNT_COLLECTIONS.staffApplications]).toBe("idUtilizador");
    // O mapa cobre EXATAMENTE as 5 coleções do loop de exclusão user-scoped.
    // users e securityLogs ficam de fora de propósito — têm lógica dedicada
    // (query própria + filtro em JS) — e não devem entrar no mapa.
    expect(Object.keys(USER_SCOPED_OWNER_FIELD).sort()).toEqual(
      [
        ACCOUNT_COLLECTIONS.subscriptions,
        ACCOUNT_COLLECTIONS.teams,
        ACCOUNT_COLLECTIONS.notifications,
        ACCOUNT_COLLECTIONS.activityLogs,
        ACCOUNT_COLLECTIONS.staffApplications,
      ].sort()
    );
  });

  it("recognizes files owned through Appwrite user permissions", () => {
    expect(fileBelongsToUser(["read(\"any\")", "delete(\"user:user-123\")"], "user-123")).toBe(true);
    expect(fileBelongsToUser(["write(\"user:user-123\")"], "user-123")).toBe(true);
    expect(fileBelongsToUser(["delete(\"user:other\")"], "user-123")).toBe(false);
    expect(fileBelongsToUser(["delete(\"user:user-1234\")"], "user-123")).toBe(false);
    expect(fileBelongsToUser(undefined, "user-123")).toBe(false);
  });

  it("extracts all visitor hashes retained in analytics metrics", () => {
    const hashes = new Set<string>();
    collectAnalyticsVisitorHashes(JSON.stringify({
      visitorSet: ["a", "b"],
      dailyVisitors: [{ day: "2026-08-05", hashes: ["b", "c"] }],
      recentVisitors: [{ id: "d" }],
    }), hashes);
    expect([...hashes].sort()).toEqual(["a", "b", "c", "d"]);
  });
});
