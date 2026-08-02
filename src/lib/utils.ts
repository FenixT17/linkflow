import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------- Color helpers ----------
// Usado pelos color pickers do tema glass (borda, acento, texto).
// O <input type="color"> só aceita hex, mas a aparência guarda cores
// como "rgba(255,255,255,0.06)". Estas funções fazem a ponte.

/**
 * Converte um valor de cor guardado (hex ou rgba) num hex válido
 * para o atributo `value` de um <input type="color">.
 * Preserva o componente alfa apenas como cor; o input não suporta
 * alfa, por isso usamos o valor RGB normalizado.
 */
export function toHexColor(stored: string | undefined, fallback = "#ffffff"): string {
  if (!stored) return fallback;
  const trimmed = stored.trim();

  // Já é hex
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(trimmed)) {
    return trimmed.length === 4
      ? "#" + trimmed.slice(1).split("").map((c) => c + c).join("")
      : trimmed;
  }

  // rgba(r, g, b, a) ou rgb(r, g, b)
  const m = trimmed.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (m) {
    const [, r, g, b] = m;
    return `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
  }

  return fallback;
}

function toHexPart(n: string): string {
  return Math.min(255, Math.max(0, parseInt(n, 10))).toString(16).padStart(2, "0");
}

/**
 * Extrai o valor de alfa de uma string rgba().
 * Devolve 1 se não estiver presente ou for inválido.
 */
export function extractAlpha(stored: string | undefined): number {
  if (!stored) return 1;
  const m = stored.match(/rgba\(\s*[\d.,\s]+,\s*([\d.]+)\s*\)/i);
  if (m) {
    const a = parseFloat(m[1]);
    return Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1;
  }
  return 1;
}

/**
 * Converte um hex (de um color picker) num rgba preservando o
 * alfa anteriormente guardado, para manter o efeito glass.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.startsWith("#") ? hex.slice(1) : hex;
  const full =
    normalized.length === 3
      ? normalized.split("").map((c) => c + c).join("")
      : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- Country flags ----------

/**
 * Converte um código ISO 3166-1 alpha-2 (ex: "PT") no emoji da bandeira
 * correspondente. Códigos inválidos/ausentes devolvem o globo 🌍.
 * Usado no dashboard (resumo de países e últimos visitantes).
 */
export function countryFlag(code?: string): string {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 127397 + c.charCodeAt(0))
  );
}

// ---------- Tempo relativo (dashboard) ----------

/**
 * Tempo relativo em pt-PT a partir de um ISO string (ex: "há 5 min",
 * "há 3h", "há 2 dias"). Datas inválidas devolvem "—".
 * Usado no cartão "Últimos visitantes" (dados chegam client-side).
 */
export function timeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "há 1 dia";
  if (days < 7) return `há ${days} dias`;
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
}

/**
 * Hora absoluta HH:MM (pt-PT) a partir de um ISO string.
 * Datas inválidas devolvem string vazia.
 */
export function formatVisitTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

// ---------- CSV export ----------

/**
 * Escapa um campo para CSV e neutraliza injeção de fórmulas (OWASP).
 *
 * Células que começam com `=`, `+`, `-` ou `@` são interpretadas pelo
 * Excel/Google Sheets como fórmulas (ex: `=HYPERLINK(...)` pode executar
 * código ao abrir o ficheiro). Prefixar com uma aspa simples `'` torna o
 * valor texto puro. Campos com vírgula/aspas/linha nova são citados.
 */
export function escapeCsv(value: string | number): string {
  let str = String(value);
  // O Excel/Sheets faz trim de whitespace ao parsear CSV, por isso uma célula
  // com espaço/tab antes de `=` seria lida como fórmula. Fazemos trimStart
  // antes do teste de neutralização para nunca ser contornável.
  str = str.trimStart();
  // Neutraliza injeção de fórmulas (OWASP) — prefixa o valor com ' (texto
  // literal) quando começa por = + - @ tab ou CR.
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ---------- Link tracking ----------

/**
 * Regista um clique num link da página pública (POST /api/click).
 * Partilhado entre os componentes de tracking (trackable-link e
 * tracked-link dos templates) para evitar duplicação.
 */
export async function recordLinkClick(pageId: string, linkId: string) {
  try {
    await fetch("/api/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, linkId }),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[recordLinkClick] failed:", error);
    }
  }
}
