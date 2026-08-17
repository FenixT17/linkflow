export const ACCOUNT_COLLECTIONS = {
  users: "users",
  pages: "pages",
  links: "links",
  themes: "themes",
  analytics: "analytics",
  visits: "visits",
  collectedIps: "collected_ips",
  qrCodes: "qr_codes",
  subscriptions: "subscriptions",
  teams: "teams",
  notifications: "notifications",
  activityLogs: "activity_logs",
  securityLogs: "security_logs",
  staffApplications: "staff_applications",
  dadosParaEstudos: "dados_para_estudos",
} as const;

export const USER_SCOPED_COLLECTIONS = [
  ACCOUNT_COLLECTIONS.users,
  ACCOUNT_COLLECTIONS.subscriptions,
  ACCOUNT_COLLECTIONS.teams,
  ACCOUNT_COLLECTIONS.notifications,
  ACCOUNT_COLLECTIONS.activityLogs,
  ACCOUNT_COLLECTIONS.securityLogs,
  ACCOUNT_COLLECTIONS.staffApplications,
] as const;

export const PAGE_SCOPED_COLLECTIONS = [
  ACCOUNT_COLLECTIONS.links,
  ACCOUNT_COLLECTIONS.themes,
  ACCOUNT_COLLECTIONS.analytics,
  ACCOUNT_COLLECTIONS.visits,
  ACCOUNT_COLLECTIONS.qrCodes,
  ACCOUNT_COLLECTIONS.dadosParaEstudos,
] as const;

/**
 * Campo do dono por coleção user-scoped na exclusão de conta.
 *
 * ATENÇÃO (Sessão 43): a coleção `teams` usa `idProprietario` como campo do dono,
 * NÃO `idUtilizador` — consultar `idUtilizador` aí falhava com "Attribute not found in
 * schema: idUtilizador" e abortava a exclusão depois de as páginas já terem sido
 * apagadas. Este mapa é a fonte única da verdade para as queries de limpeza.
 */
export const USER_SCOPED_OWNER_FIELD: Record<string, string> = {
  [ACCOUNT_COLLECTIONS.subscriptions]: "idUtilizador",
  [ACCOUNT_COLLECTIONS.teams]: "idProprietario",
  [ACCOUNT_COLLECTIONS.notifications]: "idUtilizador",
  [ACCOUNT_COLLECTIONS.activityLogs]: "idUtilizador",
  [ACCOUNT_COLLECTIONS.staffApplications]: "idUtilizador",
};

/**
 * Storage files are owned through per-file permissions such as
 * `delete("user:<idUtilizador>")`. Matching the permission is the only reliable
 * way to find older uploads that are no longer referenced by a page.
 */
export function fileBelongsToUser(
  permissions: readonly string[] | null | undefined,
  idUtilizador: string
): boolean {
  if (!idUtilizador || !Array.isArray(permissions)) return false;
  const ownerPermission = `user:${idUtilizador}`;
  return permissions.some((permission) => {
    const normalized = permission.replace(/\s/g, "");
    return normalized === `delete("${ownerPermission}")`
      || normalized === `update("${ownerPermission}")`
      || normalized === `read("${ownerPermission}")`
      || normalized === `write("${ownerPermission}")`;
  });
}

export function addUniqueId(target: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.trim()) target.add(value.trim());
}

/** Extracts visitor hashes retained inside analytics JSON before the document is deleted. */
export function collectAnalyticsVisitorHashes(
  metricasJson: unknown,
  target: Set<string>
): void {
  if (typeof metricasJson !== "string" || !metricasJson) return;
  try {
    const metrics = JSON.parse(metricasJson) as {
      visitorSet?: unknown;
      dailyVisitors?: unknown;
      recentVisitors?: unknown;
    };

    if (Array.isArray(metrics.visitorSet)) {
      metrics.visitorSet.forEach((hash) => addUniqueId(target, hash));
    }
    if (Array.isArray(metrics.dailyVisitors)) {
      metrics.dailyVisitors.forEach((day) => {
        if (day && typeof day === "object" && Array.isArray((day as { hashes?: unknown }).hashes)) {
          (day as { hashes: unknown[] }).hashes.forEach((hash) => addUniqueId(target, hash));
        }
      });
    }
    if (Array.isArray(metrics.recentVisitors)) {
      metrics.recentVisitors.forEach((visitor) => {
        if (visitor && typeof visitor === "object") {
          addUniqueId(target, (visitor as { id?: unknown }).id);
        }
      });
    }
  } catch {
    // Corrupt/legacy metrics must never prevent the remaining account data
    // from being removed.
  }
}
