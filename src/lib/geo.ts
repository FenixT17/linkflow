/**
 * GeoIP — resolução de país/cidade a partir do IP do visitante.
 *
 * Privacidade: o IP é usado apenas no servidor para descobrir o país e
 * evitar duplicados. Nunca é devolvido ao cliente nem guardado em
 * agregados — apenas no log bruto de visits (coleção server-only).
 *
 * Estratégia (por ordem):
 * 1. Cabeçalhos GeoIP da infraestrutura (Cloudflare: cf-ipcountry; headers
 *    legados do Netlify x-country/x-country-name/x-city mantidos por
 *    compatibilidade). Zero custo quando disponíveis.
 * 2. Fallback: API gratuita country.is (sem key, uso comercial permitido)
 *    com cache em memória por IP (TTL 24h) para não exceder o rate limit.
 * 3. IPs privados/locais (dev) → sem lookup, devolvem vazio.
 */

import { createHash, createHmac } from "node:crypto";

/**
 * Segredo server-side para derivar o visitorHash (HMAC-SHA256).
 *
 * M1 (corrigido): um salt fixo hardcoded permite a um atacante com acesso
 * à base de dados reverter o hash por força bruta sobre o espaço IPv4
 * (~2^32 endereços) e desanonimizar visitantes. Com um segredo fora do
 * bundle (env var), o hash só é reversível por quem conhecer o segredo.
 *
 * Quando a variável não está definida (dev/testes), mantém-se o salt
 * legado por compatibilidade — os hashes antigos continuam a coincidir.
 * Definir `IP_HASH_SECRET` em produção (o valor NUNCA deve ir para o
 * bundle NEXT_PUBLIC_*; reiniciar o contador de visitantes ao defini-lo).
 */
const ipHashSecret = (process.env.IP_HASH_SECRET ?? "").trim();


export interface GeoInfo {
  country?: string;
  countryCode?: string;
  city?: string;
  /** Latitude aproximada (city-level) — só disponível via lookup externo. */
  latitude?: number;
  /** Longitude aproximada (city-level) — só disponível via lookup externo. */
  longitude?: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_CACHE = 10_000;
const cache = new Map<string, { info: GeoInfo; expiresAt: number }>();

const PRIVATE_IP_RE =
  /^(::1|::ffff:127\.|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/;

export function isPrivateIp(ip: string | null | undefined): boolean {
  if (!ip || ip === "unknown" || ip === "::1") return true;
  return PRIVATE_IP_RE.test(ip);
}

/** Nome do país a partir do código ISO (fallback para o próprio código). */
export function getCountryName(countryCode: string): string {
  try {
    const name = new Intl.DisplayNames(["pt"], { type: "region" }).of(countryCode.toUpperCase());
    return name || countryCode;
  } catch {
    return countryCode;
  }
}

function readHeaderGeo(request: Request): GeoInfo | null {
  // Cloudflare injeta cf-ipcountry (código ISO 3166-1 alpha-2) em todos os
  // pedidos; x-country era o header da infraestrutura Netlify — mantido por
  // compatibilidade caso o header volte a existir.
  const code = request.headers.get("cf-ipcountry") ?? request.headers.get("x-country");
  if (code) {
    const name = request.headers.get("x-country-name") ?? getCountryName(code);
    const city = request.headers.get("x-city") || undefined;
    return { country: name, countryCode: code.toUpperCase(), city };
  }
  return null;
}

/** Cache das coordenadas (ipwho.is) — mesmo TTL de 24h que o país. */
const COORDS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const coordsCache = new Map<string, { info: GeoInfo; expiresAt: number }>();

/**
 * Lookup de coordenadas aproximadas (city-level) via ipwho.is — gratuito,
 * sem chave, HTTPS. Devolve latitude/longitude + país/cidade (fill-in).
 * Valores inválidos/falhas devolvem {} (nunca quebram o fluxo).
 */
export async function lookupCoordinates(ip: string): Promise<GeoInfo> {
  const cached = coordsCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
    });
    if (!res.ok) return {};
    const data = (await res.json()) as {
      success?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      country?: string | null;
      country_code?: string | null;
      city?: string | null;
    };
    const info: GeoInfo =
      data.success === false || data.latitude == null || data.longitude == null
        ? {}
        : {
            latitude: data.latitude,
            longitude: data.longitude,
            country: data.country || undefined,
            countryCode: data.country_code ? data.country_code.toUpperCase() : undefined,
            city: data.city || undefined,
          };
    coordsCache.set(ip, { info, expiresAt: Date.now() + COORDS_CACHE_TTL_MS });
    if (coordsCache.size > MAX_CACHE) {
      // LRU simples: limpa expiradas; se ainda exceder, apaga as mais antigas
      // (mesma lógica do cache de país — evita crescimento ilimitado).
      const now = Date.now();
      for (const [key, entry] of coordsCache) {
        if (entry.expiresAt <= now) coordsCache.delete(key);
      }
      if (coordsCache.size > MAX_CACHE) {
        const keys = [...coordsCache.keys()];
        for (const key of keys.slice(0, keys.length - MAX_CACHE)) coordsCache.delete(key);
      }
    }
    return info;
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve GeoInfo **com coordenadas aproximadas** (compatíveis com Google
 * Maps: lat/lng city-level). Usado pela tabela "Dados para Estudos".
 *
 * - Cabeçalhos da infra têm prioridade para país/cidade (zero custo).
 * - As coordenadas vêm do lookup ipwho.is (cache 24h) — nunca de headers.
 * - IPs privados/dev → sem lookup externo (devolve apenas o geo de headers).
 */
export async function resolveGeoWithCoordinates(
  ip: string,
  request?: Request
): Promise<GeoInfo> {
  const base = await resolveGeo(ip, request);
  if (isPrivateIp(ip)) return base;
  const coords = await lookupCoordinates(ip);
  // base (headers/country.is) tem prioridade para país/cidade; o lookup
  // preenche latitude/longitude (e o que faltar de país/cidade).
  return { ...coords, ...base };
}

async function lookupCountryIs(ip: string): Promise<GeoInfo | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(`https://api.country.is/${encodeURIComponent(ip)}?fields=country,city`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string; city?: string | null };
    if (!data.country) return null;
    return {
      country: getCountryName(data.country),
      countryCode: data.country.toUpperCase(),
      city: data.city || undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve GeoInfo para um IP. Tenta cabeçalhos da infra, depois API com cache.
 */
export async function resolveGeo(ip: string, request?: Request): Promise<GeoInfo> {
  if (request) {
    const headerGeo = readHeaderGeo(request);
    if (headerGeo) return headerGeo;
  }
  if (isPrivateIp(ip)) return {};

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  const info = (await lookupCountryIs(ip)) ?? {};
  cache.set(ip, { info, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > MAX_CACHE) {
    // LRU simples: limpa entradas expiradas; se ainda exceder, apaga as mais antigas
    const now = Date.now();
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(key);
    }
    if (cache.size > MAX_CACHE) {
      const keys = [...cache.keys()];
      for (const key of keys.slice(0, keys.length - MAX_CACHE)) cache.delete(key);
    }
  }
  return info;
}

/**
 * Hash determinístico e não reversível do IP (para visitorHash).
 *
 * Com `IP_HASH_SECRET` definido usa HMAC-SHA256 (RFC 2104) com o segredo
 * server-side — não reversível na prática por quem só tem acesso à BD.
 * Sem segredo (dev/testes) usa SHA-256 com salt fixo legado.
 *
 * Devolve os primeiros 16 hex chars (64 bits): espaço suficiente para
 * deduplicar visitantes sem colisões práticas (birthday bound ~2^32) e
 * compacto o suficiente para caber nos limites de memória do metricsJson
 * (1MB — visitorSet 2000, dailyVisitors 14×1000).
 */
export function hashIp(ip: string): string {
  if (ipHashSecret) {
    return hashIpWithSecret(ip, ipHashSecret);
  }
  const salt = "linkflow-visitor-v1";
  const input = `${salt}:${ip}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * HMAC-SHA256 do IP com um segredo server-side (16 hex chars). Extraído
 * para ser testável sem depender da env var IP_HASH_SECRET.
 */
export function hashIpWithSecret(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip, "utf8").digest("hex").slice(0, 16);
}
