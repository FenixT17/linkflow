/**
 * Social networks — URL building, validation and sanitization.
 *
 * Shared by the dashboard UI (real-time preview) and the service layer
 * (server-side normalization before persisting). All validation uses the
 * URL() API and strict protocol allowlists — never innerHTML/eval.
 *
 * Only the following fields are ever persisted per entry:
 *   platform, url (normalized), username (optional), order, active
 */

import { getPlatform, PLATFORMS } from "./platforms";
import { isValidEmail } from "./sanitize";
import type { SocialLinkEntry } from "./types";

/** Protocols that are NEVER allowed (XSS / data exfiltration vectors). */
const UNSAFE_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:", "blob:"];

/** Ordered ids of the platforms exposed in the social networks section. */
export const SOCIAL_PLATFORM_IDS = [
  "instagram",
  "facebook",
  "x",
  "tiktok",
  "youtube",
  "linkedin",
  "github",
  "gitlab",
  "discord",
  "telegram",
  "whatsapp",
  "threads",
  "bluesky",
  "reddit",
  "pinterest",
  "snapchat",
  "twitch",
  "kick",
  "steam",
  "spotify",
  "soundcloud",
  "applemusic",
  "deezer",
  "bandcamp",
  "medium",
  "substack",
  "behance",
  "dribbble",
  "figma",
  "codepen",
  "devto",
  "hashnode",
  "mastodon",
  "patreon",
  "kofi",
  "buymeacoffee",
  "onlyfans",
  "trello",
  "notion",
  "calendly",
  "email",
  "website",
  "portfolio",
  "blog",
] as const;

/** Platforms that accept a full URL but never auto-generate from a username. */
const FULL_URL_ONLY = new Set(["website", "portfolio", "blog", "notion", "trello", "applemusic", "deezer"]);

/** Host aliases accepted when a full URL is provided for a platform. */
const HOST_ALIASES: Record<string, string[]> = {
  instagram: ["instagram.com"],
  facebook: ["facebook.com", "fb.com"],
  x: ["x.com", "twitter.com"],
  tiktok: ["tiktok.com", "vm.tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  linkedin: ["linkedin.com", "linkedin.pt"],
  github: ["github.com"],
  gitlab: ["gitlab.com"],
  discord: ["discord.com", "discord.gg", "discordapp.com"],
  telegram: ["t.me", "telegram.me", "telegram.org"],
  whatsapp: ["wa.me", "whatsapp.com", "api.whatsapp.com"],
  threads: ["threads.net"],
  bluesky: ["bsky.app"],
  reddit: ["reddit.com", "www.reddit.com"],
  pinterest: ["pinterest.com", "pinterest.pt", "pinterest.co.uk"],
  snapchat: ["snapchat.com"],
  twitch: ["twitch.tv"],
  kick: ["kick.com"],
  steam: ["steamcommunity.com", "store.steampowered.com"],
  spotify: ["open.spotify.com", "spotify.com"],
  soundcloud: ["soundcloud.com"],
  applemusic: ["music.apple.com", "itunes.apple.com", "apple.co"],
  deezer: ["deezer.com"],
  bandcamp: ["bandcamp.com"],
  medium: ["medium.com"],
  substack: ["substack.com"],
  behance: ["behance.net"],
  dribbble: ["dribbble.com"],
  figma: ["figma.com", "www.figma.com"],
  codepen: ["codepen.io"],
  devto: ["dev.to"],
  hashnode: ["hashnode.com"],
  patreon: ["patreon.com"],
  kofi: ["ko-fi.com"],
  buymeacoffee: ["buymeacoffee.com"],
  onlyfans: ["onlyfans.com"],
  trello: ["trello.com"],
  notion: ["notion.so", "notion.site"],
  calendly: ["calendly.com"],
};

export interface SocialUrlResult {
  /** Final normalized URL, or "" when invalid. */
  url: string;
  /** Raw username when derived from a username (optional). */
  username?: string;
  /** Human-readable validation error (empty when valid). */
  error?: string;
}

/** Platforms available in the social section, in display order. */
export function getSocialPlatforms() {
  return SOCIAL_PLATFORM_IDS.map((id) => getPlatform(id)).filter(
    (p): p is (typeof PLATFORMS)[number] => Boolean(p)
  );
}

/** Search platforms by name, id or keywords. */
export function searchSocialPlatforms(query: string) {
  const q = query.trim().toLowerCase();
  const all = getSocialPlatforms();
  if (!q) return all;
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (p.keywords ?? []).some((k) => k.toLowerCase().includes(q))
  );
}

/** Does the input look like a full URL (has a scheme)? */
export function isFullUrlInput(input: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(input.trim());
}

/**
 * Sanitize a username handle: strip leading @, whitespace, control chars
 * and any character outside [a-zA-Z0-9._~-].
 */
function sanitizeHandle(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .replace(/[\u0000-\u001f\u007f\s]+/g, "")
    .replace(/[^\w.~-]/g, "")
    .slice(0, 128);
}

/** Validate a hostname against a platform's allowed host aliases. */
function hostMatches(url: URL, platformId: string): boolean {
  const aliases = HOST_ALIASES[platformId];
  if (!aliases || aliases.length === 0) return true;
  const host = url.hostname.toLowerCase();
  return aliases.some((alias) => host === alias || host.endsWith(`.${alias}`));
}

/**
 * Build a normalized URL from a username OR validate a provided full URL.
 *
 * Rules:
 * - username → generated from the platform urlPrefix (e.g. joao → https://instagram.com/joao)
 * - full URL   → validated with the URL() API; HTTPS only for external platforms;
 *                mailto: only for email; tel: only for phone
 * - unsafe protocols (javascript:, data:, vbscript:, file:, blob:) are always blocked
 */
export function buildSocialUrl(platformId: string, raw: string): SocialUrlResult {
  const platform = getPlatform(platformId);
  if (!platform) {
    return { url: "", error: "Plataforma desconhecida." };
  }

  const input = raw.trim();
  if (!input) {
    return { url: "", error: "Indique o nome de utilizador ou a URL." };
  }

  // ── Full URL path ─────────────────────────────────────────────
  if (isFullUrlInput(input)) {
    const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(input);
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : "";
    if (UNSAFE_PROTOCOLS.includes(`${scheme}:`)) {
      return { url: "", error: "Protocolo não permitido." };
    }

    // Email
    if (platform.id === "email") {
      if (scheme === "mailto") {
        const address = input.slice("mailto:".length).trim();
        if (!isValidEmail(address)) {
          return { url: "", error: "Email inválido." };
        }
        return { url: `mailto:${address}`, username: address };
      }
      return { url: "", error: "Use mailto: ou indique apenas o email." };
    }

    // Phone — tel: allowed only for WhatsApp (per spec: "tel: apenas quando aplicável")
    if (platform.id === "whatsapp" && scheme === "tel") {
      const number = input.slice("tel:".length).trim();
      const normalized = number.replace(/[\s()-]/g, "");
      if (!/^\+?\d{7,15}$/.test(normalized)) {
        return { url: "", error: "Número de telefone inválido. Use formato internacional, ex.: tel:+351912345678." };
      }
      return { url: `tel:${normalized}`, username: normalized };
    }

    // Only HTTPS allowed for external platforms
    if (scheme !== "https") {
      return { url: "", error: "Apenas URLs HTTPS são permitidas." };
    }

    try {
      const url = new URL(input);
      if (url.protocol !== "https:") {
        return { url: "", error: "Apenas URLs HTTPS são permitidas." };
      }
      if (!hostMatches(url, platformId)) {
        return { url: "", error: `URL inválida para ${platform.name}.` };
      }
      return { url: url.toString() };
    } catch {
      return { url: "", error: "URL inválida." };
    }
  }

  // ── Username path ─────────────────────────────────────────────

  // Email from a bare address — validate the RAW input (keeps the @)
  if (platform.id === "email") {
    if (!isValidEmail(input)) {
      return { url: "", error: "Email inválido." };
    }
    return { url: `mailto:${input}`, username: input };
  }

  const handle = sanitizeHandle(input);
  if (!handle) {
    return { url: "", error: "Nome de utilizador inválido." };
  }

  // Platforms that require a full URL
  if (FULL_URL_ONLY.has(platformId)) {
    return { url: "", error: `Indique a URL completa de ${platform.name}.` };
  }

  if (!platform.urlPrefix) {
    return { url: "", error: `Indique a URL completa de ${platform.name}.` };
  }

  const generated = `${platform.urlPrefix}${handle}`;
  try {
    const url = new URL(generated);
    if (url.protocol !== "https:") {
      return { url: "", error: "Apenas URLs HTTPS são permitidas." };
    }
    return { url: url.toString(), username: handle };
  } catch {
    return { url: "", error: "URL gerada inválida." };
  }
}

/**
 * Normalize one raw entry (from DB or client) into a safe SocialLinkEntry.
 * Returns null when the platform is unknown or the URL is invalid.
 */
export function normalizeSocialEntry(raw: unknown): SocialLinkEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const platform = typeof obj.platform === "string" ? obj.platform : "";
  if (!getPlatform(platform)) return null;

  const urlRaw = typeof obj.url === "string" ? obj.url : "";
  const usernameRaw = typeof obj.username === "string" ? obj.username : "";
  const built = buildSocialUrl(platform, urlRaw || usernameRaw);
  if (!built.url) return null;

  return {
    platform,
    url: built.url,
    username: built.username,
    order:
      typeof obj.order === "number" && Number.isFinite(obj.order)
        ? Math.max(0, Math.floor(obj.order))
        : 0,
    active: obj.active !== false,
  };
}

/**
 * Sanitize an array of social entries (defense in depth, used by the
 * service layer before persisting). Deduplicates by platform and
 * re-sorts by order. Never persists HTML/SVG/scripts — only safe fields.
 */
export function sanitizeSocialEntries(input: unknown): SocialLinkEntry[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const result: SocialLinkEntry[] = [];
  for (const raw of input) {
    const entry = normalizeSocialEntry(raw);
    if (!entry) continue;
    if (seen.has(entry.platform)) continue;
    seen.add(entry.platform);
    result.push(entry);
  }
  return result.sort((a, b) => a.order - b.order);
}
