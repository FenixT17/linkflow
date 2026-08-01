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
