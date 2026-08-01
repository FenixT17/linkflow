import type { Databases, Models } from "node-appwrite";
import { ID, Permission, Query, Role } from "node-appwrite";
import { databaseId } from "./appwrite.server";
import { detectDeviceType, type DeviceType } from "./device-detect";
import { hashIp, type GeoInfo } from "./geo";
import type { TopCountry, TopDevice, TopLink, Visitor } from "./types";

export interface DailyStat {
  day: string;
  views: number;
  clicks: number;
}

export function updateDailyStats(
  dailyStats: DailyStat[],
  type: "views" | "clicks"
): DailyStat[] {
  const today = new Date().toISOString().split("T")[0];
  const index = dailyStats.findIndex((s) => s.day === today);
  if (index >= 0) {
    return dailyStats.map((s, i) =>
      i === index ? { ...s, [type]: (s[type] ?? 0) + 1 } : s
    );
  }
  return [
    ...dailyStats,
    {
      day: today,
      views: type === "views" ? 1 : 0,
      clicks: type === "clicks" ? 1 : 0,
    },
  ];
}

/** Número máximo de hashes únicos guardados nos agregados (evita crescimento infinito). */
const MAX_VISITOR_SET = 2000;
const MAX_RECENT_VISITORS = 25;
/** Dias de hashes únicos guardados por dia (base do crescimento real de visitantes). */
const MAX_DAILY_VISITOR_DAYS = 14;
/** Máximo de hashes por dia (limite de memória — os antigos saem da janela). */
const MAX_DAILY_HASHES = 1000;

/** Hash de visitante único registado num dia (agregação para o crescimento). */
interface DailyVisitorDay {
  day: string;
  hashes: string[];
}

export interface RecordAnalyticsEventInput {
  pageId: string;
  ownerUserId: string;
  type: "views" | "clicks";
  userAgent: string;
  ip: string;
  referer?: string;
  geo?: GeoInfo;
  browser?: string;
  os?: string;
  device?: DeviceType;
  linkId?: string;
  linkTitle?: string;
  linkUrl?: string;
}

// ---------- Agregadores puros (sem I/O) ----------

function upsertTopCountry(topCountries: TopCountry[], geo: GeoInfo | undefined): TopCountry[] {
  const code = (geo?.countryCode || "XX").toUpperCase();
  const name = geo?.country || "Desconhecido";
  const existing = topCountries.find((c) => (c.countryCode || "XX") === code);
  if (existing) {
    existing.count += 1;
  } else {
    topCountries.push({ country: name, countryCode: code, count: 1 });
  }
  return topCountries;
}

function upsertTopDevice(topDevices: TopDevice[], device: DeviceType): TopDevice[] {
  const existing = topDevices.find((d) => d.type === device);
  if (existing) {
    existing.count += 1;
  } else {
    topDevices.push({ type: device, count: 1, percentage: 0 });
  }
  return topDevices;
}

function upsertTopLink(
  topLinks: TopLink[],
  input: RecordAnalyticsEventInput,
  totalClicks: number
): TopLink[] {
  if (!input.linkId) return topLinks;
  const existing = topLinks.find((l) => l.id === input.linkId);
  if (existing) {
    existing.clicks += 1;
  } else {
    topLinks.push({
      id: input.linkId,
      title: input.linkTitle || "Link",
      url: input.linkUrl,
      clicks: 1,
      ctr: 0,
    });
  }
  // CTR real por link = cliques no link / total de cliques * 100
  return topLinks.map((l) => ({
    ...l,
    ctr: totalClicks > 0 ? Math.round((l.clicks / totalClicks) * 100) : 0,
  }));
}

function buildRecentVisitor(input: RecordAnalyticsEventInput, visitorHash: string): Visitor {
  return {
    id: visitorHash,
    country: input.geo?.country || "Desconhecido",
    countryCode: input.geo?.countryCode,
    city: input.geo?.city,
    device: input.device ?? detectDeviceType(input.userAgent),
    browser: input.browser || "Desconhecido",
    os: input.os || "Desconhecido",
    referer: input.referer,
    time: new Date().toISOString(),
  };
}

// ---------- Crescimento (7 vs 7 dias) ----------

/** Soma de views/cliques entre [now - fromDays, now - toDays] (toDays=0 → hoje). */
function sumRange(dailyStats: DailyStat[], key: "views" | "clicks", fromDays: number, toDays = 0): number {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - fromDays);
  const end = new Date(now);
  end.setDate(now.getDate() - toDays);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  return dailyStats
    .filter((d) => d.day >= startStr && d.day <= endStr)
    .reduce((sum, d) => sum + (d[key] || 0), 0);
}

/** Visitantes únicos (hashes distintos) entre [now - fromDays, now - toDays]. */
function uniqueVisitorsInRange(dailyVisitors: DailyVisitorDay[], fromDays: number, toDays = 0): number {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - fromDays);
  const end = new Date(now);
  end.setDate(now.getDate() - toDays);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  const set = new Set<string>();
  for (const d of dailyVisitors) {
    if (d.day >= startStr && d.day <= endStr) {
      for (const h of d.hashes) set.add(h);
    }
  }
  return set.size;
}

function computeGrowth(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

/** Crescimento real de visitantes: últimos 7 dias vs os 7 dias anteriores. */
function computeVisitorGrowth(dailyVisitors: DailyVisitorDay[]): number {
  return computeGrowth(
    uniqueVisitorsInRange(dailyVisitors, 7),
    uniqueVisitorsInRange(dailyVisitors, 14, 7)
  );
}

interface MetricsState {
  metrics: Record<string, unknown>;
}

function applyEventToMetrics(
  prevMetrics: Record<string, unknown>,
  input: RecordAnalyticsEventInput,
  newViews: number,
  newClicks: number
): MetricsState {
  const metrics = { ...prevMetrics };
  const device = input.device ?? detectDeviceType(input.userAgent);

  // Agregados por tipo de evento (views → país/dispositivo/visitante; clicks → links)
  if (input.type === "views") {
    metrics.topCountries = upsertTopCountry(
      Array.isArray(metrics.topCountries) ? (metrics.topCountries as TopCountry[]) : [],
      input.geo
    );
    metrics.topDevices = upsertTopDevice(
      Array.isArray(metrics.topDevices) ? (metrics.topDevices as TopDevice[]) : [],
      device
    );

    // Visitantes únicos (dedup por hash do IP)
    const visitorHash = hashIp(input.ip);
    const visitorSet: string[] = Array.isArray(metrics.visitorSet)
      ? (metrics.visitorSet as string[])
      : [];
    if (!visitorSet.includes(visitorHash)) {
      visitorSet.push(visitorHash);
      if (visitorSet.length > MAX_VISITOR_SET) {
        visitorSet.splice(0, visitorSet.length - MAX_VISITOR_SET);
      }
      metrics.uniqueVisitors = Number(metrics.uniqueVisitors ?? 0) + 1;
    }
    metrics.visitorSet = visitorSet;

    // Visitantes únicos por dia (limitado) — base real para o crescimento
    const dailyVisitors: DailyVisitorDay[] = Array.isArray(metrics.dailyVisitors)
      ? (metrics.dailyVisitors as DailyVisitorDay[])
      : [];
    const today = new Date().toISOString().split("T")[0];
    const dayIndex = dailyVisitors.findIndex((d) => d.day === today);
    if (dayIndex >= 0) {
      const day = dailyVisitors[dayIndex];
      if (!day.hashes.includes(visitorHash) && day.hashes.length < MAX_DAILY_HASHES) {
        day.hashes.push(visitorHash);
      }
    } else {
      dailyVisitors.push({ day: today, hashes: [visitorHash] });
      dailyVisitors.sort((a, b) => a.day.localeCompare(b.day));
      if (dailyVisitors.length > MAX_DAILY_VISITOR_DAYS) {
        dailyVisitors.splice(0, dailyVisitors.length - MAX_DAILY_VISITOR_DAYS);
      }
    }
    metrics.dailyVisitors = dailyVisitors;
    metrics.visitorGrowth = computeVisitorGrowth(dailyVisitors);

    // Últimos visitantes (sem IP — privacidade)
    const recent: Visitor[] = Array.isArray(metrics.recentVisitors)
      ? (metrics.recentVisitors as Visitor[])
      : [];
    recent.unshift(buildRecentVisitor(input, visitorHash));
    metrics.recentVisitors = recent.slice(0, MAX_RECENT_VISITORS);
  } else {
    metrics.topLinks = upsertTopLink(
      Array.isArray(metrics.topLinks) ? (metrics.topLinks as TopLink[]) : [],
      input,
      newClicks
    );
  }

  // CTR global real = cliques / visitantes únicos * 100
  const uniqueVisitors = Number(metrics.uniqueVisitors ?? 0);
  metrics.ctr = uniqueVisitors > 0 ? Math.round((newClicks / uniqueVisitors) * 100) : 0;

  // Crescimento real de visualizações (7 vs 7 dias) para os trends do dashboard
  const dailyStats = Array.isArray(metrics.dailyStats) ? (metrics.dailyStats as DailyStat[]) : [];
  metrics.weeklyGrowth = computeGrowth(sumRange(dailyStats, "views", 7), sumRange(dailyStats, "views", 14, 7));
  metrics.monthlyGrowth = computeGrowth(sumRange(dailyStats, "views", 30), sumRange(dailyStats, "views", 60, 30));

  return { metrics };
}

// ---------- Upsert do documento de analytics ----------

function createInitialMetrics(input: RecordAnalyticsEventInput, newViews: number, newClicks: number) {
  const dailyStats = updateDailyStats([], input.type);
  const { metrics } = applyEventToMetrics(
    {
      ctr: 0,
      weeklyGrowth: 0,
      monthlyGrowth: 0,
      visitorGrowth: 0,
      topLinks: [],
      topCountries: [],
      topDevices: [],
      recentVisitors: [],
      hourlyStats: [],
      dailyStats,
      visitorSet: [],
      dailyVisitors: [],
      uniqueVisitors: 0,
    },
    input,
    newViews,
    newClicks
  );
  return metrics;
}

async function incrementAnalyticsMetric(
  databases: Databases,
  doc: Models.Document,
  input: RecordAnalyticsEventInput
): Promise<void> {
  const fields = doc as Models.Document & Record<string, unknown>;
  const prevViews = Number(fields.views) || 0;
  const prevClicks = Number(fields.clicks) || 0;
  const newViews = prevViews + (input.type === "views" ? 1 : 0);
  const newClicks = prevClicks + (input.type === "clicks" ? 1 : 0);

  const metricsJson = JSON.parse(String(fields.metricsJson || "{}"));
  const dailyStats = Array.isArray(metricsJson.dailyStats) ? metricsJson.dailyStats : [];
  const updatedDaily = updateDailyStats(dailyStats, input.type);
  const { metrics } = applyEventToMetrics({ ...metricsJson, dailyStats: updatedDaily }, input, newViews, newClicks);

  const patch: Record<string, unknown> = {
    metricsJson: JSON.stringify(metrics),
    views: newViews,
    clicks: newClicks,
    followers: Number(metrics.uniqueVisitors ?? 0),
  };

  await databases.updateDocument(databaseId, "analytics", doc.$id, patch);
}

/**
 * Regista um evento real (view ou click) de um visitante da página pública.
 *
 * - Atualiza os agregados reais no documento analytics (países, dispositivos,
 *   links, visitantes únicos, CTR) — nunca dados simulados.
 * - Cria o documento se não existir (páginas antigas passam a ser contadas).
 * - Trata a race do índice único em pageId (409) re-consultando e atualizando.
 * - Grava um registo bruto na coleção server-only `visits` (IP nunca exposto
 *   ao cliente — usado apenas para país, dedup e estatísticas).
 */
export async function recordAnalyticsEvent(
  databases: Databases,
  input: RecordAnalyticsEventInput
): Promise<void> {
  const newViews = input.type === "views" ? 1 : 0;
  const newClicks = input.type === "clicks" ? 1 : 0;

  const docs = await databases.listDocuments(databaseId, "analytics", [
    Query.equal("pageId", input.pageId),
  ]);

  if (docs.documents.length > 0) {
    await incrementAnalyticsMetric(databases, docs.documents[0], input);
  } else {
    const firstMetrics = createInitialMetrics(input, newViews, newClicks);
    try {
      await databases.createDocument(databaseId, "analytics", ID.unique(), {
        pageId: input.pageId,
        views: newViews,
        clicks: newClicks,
        followers: Number(firstMetrics.uniqueVisitors ?? 0),
        metricsJson: JSON.stringify(firstMetrics),
      }, [
        Permission.read(Role.user(input.ownerUserId)),
        Permission.update(Role.user(input.ownerUserId)),
        Permission.delete(Role.user(input.ownerUserId)),
      ]);
    } catch (createError) {
      // Race: outro pedido criou o doc entretanto (índice único em pageId)
      const retry = await databases.listDocuments(databaseId, "analytics", [
        Query.equal("pageId", input.pageId),
      ]);
      if (retry.documents.length === 0) throw createError;
      await incrementAnalyticsMetric(databases, retry.documents[0], input);
    }
  }

  // Registo bruto da visita (server-only — o cliente nunca lê esta coleção).
  try {
    await databases.createDocument(databaseId, "visits", ID.unique(), {
      pageId: input.pageId,
      visitorHash: hashIp(input.ip),
      ip: input.ip.slice(0, 64),
      country: input.geo?.country ?? "",
      countryCode: input.geo?.countryCode ?? "",
      city: input.geo?.city ?? "",
      device: input.device ?? detectDeviceType(input.userAgent),
      browser: input.browser ?? "",
      os: input.os ?? "",
      referer: input.referer ?? "",
      userAgent: input.userAgent.slice(0, 500),
      clickedLink: input.linkId ?? "",
      createdAt: new Date().toISOString(),
    });
  } catch (visitError) {
    // Nunca deve quebrar o tracking principal
    console.error("[analytics] failed to store raw visit:", visitError);
  }
}
