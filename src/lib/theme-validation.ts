const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;
const HSL_COLOR = /^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i;

export const SAFE_FONT_FAMILIES = [
  "Inter",
  "Geist",
  "Arial",
  "Helvetica",
  "system-ui",
  "sans-serif",
  "serif",
  "monospace",
] as const;

function isValidRgb(value: string): boolean {
  const match = value.match(RGB_COLOR);
  if (!match) return false;
  return [match[1], match[2], match[3]].every((channel) => Number(channel) >= 0 && Number(channel) <= 255);
}

function isValidHsl(value: string): boolean {
  const match = value.match(HSL_COLOR);
  if (!match) return false;
  return Number(match[1]) <= 360 && Number(match[2]) <= 100 && Number(match[3]) <= 100;
}

export function isSafeThemeColor(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 128) return false;
  const normalized = value.trim();
  return HEX_COLOR.test(normalized) || isValidRgb(normalized) || isValidHsl(normalized);
}

export function isSafeThemeFont(value: unknown): value is string {
  return typeof value === "string" && (SAFE_FONT_FAMILIES as readonly string[]).includes(value.trim());
}

export function validateThemeField(field: string, value: unknown): boolean {
  if (["backgroundColor", "cardColor", "textColor", "accentColor", "borderColor"].includes(field)) {
    return isSafeThemeColor(value);
  }
  if (field === "fontFamily") return isSafeThemeFont(value);
  return true;
}

export function validateThemePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Tema inválido.";
  const record = payload as Record<string, unknown>;
  for (const field of ["backgroundColor", "cardColor", "textColor", "accentColor", "borderColor", "fontFamily"]) {
    if (field in record && !validateThemeField(field, record[field])) {
      return `Valor de tema inválido: ${field}.`;
    }
  }
  return null;
}

export function safeThemeColor(value: unknown, fallback: string): string {
  return isSafeThemeColor(value) ? value.trim() : fallback;
}

export function safeThemeFont(value: unknown, fallback = "Inter"): string {
  return isSafeThemeFont(value) ? value.trim() : fallback;
}
