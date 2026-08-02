/**
 * GeoIP — resolução de país/cidade a partir do IP do visitante.
 *
 * Privacidade: o IP é usado apenas no servidor para descobrir o país e
 * evitar duplicados. Nunca é devolvido ao cliente nem guardado em
 * agregados — apenas no log bruto de visits (coleção server-only).
 *
 * Estratégia (por ordem):
 * 1. Cabeçalhos GeoIP da infraestrutura (Netlify: x-country, x-country-name,
 *    x-city, x-region). Zero custo quando disponíveis.
 * 2. Fallback: API gratuita country.is (sem key, uso comercial permitido)
 *    com cache em memória por IP (TTL 24h) para não exceder o rate limit.
 * 3. IPs privados/locais (dev) → sem lookup, devolvem vazio.
 */

import { createHash } from "node:crypto";


export interface GeoInfo {
  country?: string;
  countryCode?: string;
  city?: string;
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
  const code = request.headers.get("x-country") ?? request.headers.get("cf-ipcountry");
  if (code) {
    const name = request.headers.get("x-country-name") ?? getCountryName(code);
    const city = request.headers.get("x-city") || undefined;
    return { country: name, countryCode: code.toUpperCase(), city };
  }
  return null;
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
 * SHA-256 real (RFC 6234) com salt fixo — não reversível na prática para
 * um atacante com acesso à BD (a força bruta sobre o espaço IPv4 exigiria
 * ~2^32 tentativas de SHA-256, e o salt impede rainbow tables pré-computadas).
 *
 * Devolve os primeiros 16 hex chars (64 bits): espaço suficiente para
 * deduplicar visitantes sem colisões práticas (birthday bound ~2^32) e
 * compacto o suficiente para caber nos limites de memória do metricsJson
 * (1MB — visitorSet 2000, dailyVisitors 14×1000).
 */
export function hashIp(ip: string): string {
  const salt = "linkflow-visitor-v1";
  const input = `${salt}:${ip}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}
