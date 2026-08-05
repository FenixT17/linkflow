import type { Databases, Models } from "node-appwrite";
import { ID, Permission, Query, Role } from "node-appwrite";
import { databaseId } from "./appwrite.server";
import { detectDeviceType, type DeviceType } from "./device-detect";
import { hashIp, isPrivateIp, lookupCoordinates, type GeoInfo } from "./geo";
import type { TopCountry, TopDevice, TopLink, Visitor } from "./types";

/**
 * Coleção server-only onde cada IP é recolhido NO MÁXIMO UMA VEZ.
 *
 * PRIVACIDADE (M6 / RGPD-LGPD): o IP CRU nunca é persistido. A chave de
 * deduplicação é `visitorHash` = hashIp(ip) — um hash salgado não reversível.
 * O campo `ip` da coleção (mantido por compatibilidade de schema) guarda
 * apenas esse hash, nunca o IP em texto plano.
 *
 * Garantias (regra de negócio):
 * - O SaaS nunca regista o mesmo IP duas vezes: o índice único em `ip` na
 *   coleção `collected_ips` rejeita (409) qualquer tentativa de gravar um
 *   hash que já existe (o mesmo IP → o mesmo hash → 409).
 * - Se o registo for APAGADO da base de dados, o próximo acesso volta a
 *   recolher esse IP + país (a chave única fica livre).
 * - IPs privados/locais (dev) são ignorados — nunca entram na tabela.
 */
export async function collectIpIfNew(
  databases: Databases,
  input: RecordAnalyticsEventInput
): Promise<{ collected: boolean; alreadyExists: boolean }> {
  const ip = (input.ip || "").trim().slice(0, 64);
  if (!ip || isPrivateIp(ip)) {
    return { collected: false, alreadyExists: false };
  }

  // Nunca usar o IP cru: deduplicação e persistência apenas via hash salgado.
  const visitorHash = hashIp(ip);

  // 1. Verifica se o IP (via hash) já foi recolhido.
  const existing = await databases.listDocuments(databaseId, "collected_ips", [
    Query.equal("visitorHash", visitorHash),
    Query.limit(1),
  ]);
  if (existing.documents.length > 0) {
    return { collected: false, alreadyExists: true };
  }

  // 2. Recolhe o país + hash. Se entretanto outro pedido gravou o mesmo IP
  //    (race), o índice único devolve 409 e tratamos como "já existe".
  const now = new Date().toISOString();
  try {
    await databases.createDocument(databaseId, "collected_ips", ID.unique(), {
      // `ip` guarda apenas o hash (nunca o IP cru) — o índice único existente
      // continua a garantir "1 registo por IP" sem persistir PII.
      ip: visitorHash,
      visitorHash,
      country: input.geo?.country ?? "",
      countryCode: input.geo?.countryCode ?? "",
      city: input.geo?.city ?? "",
      device: input.device ?? detectDeviceType(input.userAgent),
      browser: input.browser ?? "",
      os: input.os ?? "",
      firstSeenAt: now,
      lastSeenAt: now,
    });
    return { collected: true, alreadyExists: false };
  } catch (error) {
    const err = error as { code?: number; message?: string };
    // 409 = índice único violado → já existe (ou foi gravado agora mesmo).
    if (err?.code === 409 || err?.message?.includes("already exists")) {
      return { collected: false, alreadyExists: true };
    }
    throw error;
  }
}

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
  /** Nome legível do dispositivo (ex: "Pixel 7" via sec-ch-ua-model). */
  deviceName?: string;
  linkId?: string;
  linkTitle?: string;
  linkUrl?: string;
}

/**
 * Nome legível do dispositivo para a tabela de estudos.
 * Prioridade: nome explícito (UA-CH) → combinação dispositivo + OS → genérico.
 */
export function buildStudyDeviceName(
  deviceName: string | undefined,
  device: DeviceType | undefined,
  os: string | undefined,
  userAgent: string
): string {
  const explicit = deviceName?.trim();
  if (explicit) return explicit;
  const deviceLabel = device ?? detectDeviceType(userAgent);
  const osLabel = os?.trim() || "Desconhecido";
  return `${deviceLabel} (${osLabel})`;
}

/**
 * Formata lat/lng como texto bruto compatível com Google Maps.
 * Ex: 38.7294435, -9.1537627 → "38.7294435, -9.1537627" (aceite em
 * https://www.google.com/maps?q=38.7294435,-9.1537627).
 */
export function formatCoordinates(latitude?: number, longitude?: number): string {
  if (latitude == null || longitude == null) return "";
  return `${latitude}, ${longitude}`;
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
      ip: hashIp(input.ip), // FASE 2: Nunca guarda IP em texto limpo — usa apenas o hash salgado não reversível
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

  // Tabela de coleta de IPs: cada IP é guardado no máximo UMA VEZ.
  // Se o registo for apagado, o próximo acesso volta a recolher o IP + país.
  try {
    await collectIpIfNew(databases, input);
  } catch (collectError) {
    // Nunca deve quebrar o tracking principal
    console.error("[analytics] failed to collect ip:", collectError);
  }

  // Tabela "Dados para Estudos": registo bruto por interação (IP, dispositivo,
  // coordenadas aproximadas). Decisão explícita do produto — ver memoria.md.
  try {
    await collectStudyData(databases, input);
  } catch (studyError) {
    // Nunca deve quebrar o tracking principal
    console.error("[analytics] failed to collect study data:", studyError);
  }
}

/**
 * Coleção server-only `dados_para_estudos` — dados de estudo em texto bruto.
 *
 * DECISÃO EXPLÍCITA DO PRODUTO (Sessão 42): ao contrário das restantes
 * coleções (que só guardam hashes do IP), esta tabela guarda o IP CRU, o
 * nome do dispositivo e as coordenadas aproximadas (city-level) para fins
 * de estudo/análise. A coleção tem permissões [] — só o server SDK (API
 * key) escreve/lê; o cliente nunca acede. Nota RGPD/LGPD: como guarda
 * dados pessoais em texto bruto, requer aviso de privacidade/consentimento
 * adequado na página pública.
 */
async function collectStudyData(
  databases: Databases,
  input: RecordAnalyticsEventInput
): Promise<void> {
  const ip = (input.ip || "").trim().slice(0, 64);
  // IPs privados/locais (dev) nunca entram na tabela de estudos.
  if (!ip || isPrivateIp(ip)) return;

  // País/cidade vêm do geo já resolvido na rota (headers Netlify — zero
  // custo e mais preciso); as coordenadas aproximadas vêm do lookup ipwho.is
  // (cache 24h) — compatíveis com Google Maps.
  const coords = await lookupCoordinates(ip);
  const country = input.geo?.country || coords.country || "";
  const countryCode = input.geo?.countryCode || coords.countryCode || "";
  const city = input.geo?.city || coords.city || "";

  await databases.createDocument(databaseId, "dados_para_estudos", ID.unique(), {
    ip: ip.slice(0, 64), // IP em texto bruto (decisão explícita do produto)
    deviceName: buildStudyDeviceName(input.deviceName, input.device, input.os, input.userAgent).slice(0, 255),
    device: (input.device ?? detectDeviceType(input.userAgent)).slice(0, 32),
    browser: (input.browser || "").slice(0, 64),
    os: (input.os || "").slice(0, 64),
    userAgent: input.userAgent.slice(0, 512),
    country: country.slice(0, 128),
    countryCode: countryCode.slice(0, 8),
    city: city.slice(0, 128),
    latitude: coords.latitude != null ? String(coords.latitude).slice(0, 32) : "",
    longitude: coords.longitude != null ? String(coords.longitude).slice(0, 32) : "",
    coordinates: formatCoordinates(coords.latitude, coords.longitude).slice(0, 64),
    pageId: input.pageId.slice(0, 255),
    referer: (input.referer || "").slice(0, 512),
    createdAt: new Date().toISOString(),
  });
}
