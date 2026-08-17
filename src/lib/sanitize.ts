/**
 * Security utilities — sanitização de input e prevenção de XSS.
 *
 * O projeto usa Appwrite (NoSQL), por isso SQL injection tradicional
 * não é um risco. No entanto, o conteúdo fornecido pelo utilizador
 * (nomes, URLs, bio) é renderizado na página pública e pode conter
 * scripts maliciosos (XSS).
 */

/**
 * Remove tags HTML/script maliciosas de uma string.
 * Usa replace com regex em vez de innerHTML/DOM parsing para ser segura
 * em ambientes server-side e client-side.
 */
export function sanitizeText(input: string): string {
  if (!input) return "";
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitiza um URL para prevenir javascript: e outras pseudo-URIs.
 * Retorna o URL sanitizado ou vazio se for inválido/perigoso.
 */
export function sanitizeUrl(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();

  try {
    const url = new URL(trimmed);
    // Apenas protocolos seguros
    if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
      return "";
    }
    return trimmed;
  } catch {
    // Se não for um URL válido (ex: caminho relativo), permite só se for seguro
    if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
      return trimmed;
    }
    return "";
  }
}

/**
 * Sanitiza um URL usado como imagem. Ao contrário de links, imagens não
 * precisam de mailto/tel nem de fragmentos: aceitamos apenas HTTP(S) ou os
 * media proxies same-origin do LinkFlow.
 */
export function sanitizeMediaUrl(input: string): string {
  const sanitized = sanitizeUrl(input);
  if (!sanitized) return "";
  if (sanitized.startsWith("/api/media/")) return sanitized;
  try {
    const protocol = new URL(sanitized).protocol;
    return protocol === "http:" || protocol === "https:" ? sanitized : "";
  } catch {
    return "";
  }
}

/**
 * Sanitiza um nomeUtilizador: apenas letras minúsculas, números e underscores.
 */
export function sanitizeUsername(input: string): string {
  if (!input) return "";
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Sanitiza um nome próprio: permite letras, espaços, acentos e hífen.
 */
export function sanitizeDisplayName(input: string): string {
  if (!input) return "";
  return input.trim().replace(/<[^>]*>/g, "").slice(0, 255);
}

/**
 * Sanitiza uma bio: remove tags HTML, limita tamanho.
 */
export function sanitizeBio(input: string): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .slice(0, 4096);
}

/**
 * Valida se um email tem formato básico.
 */
export function isValidEmail(input: string): boolean {
  if (!input) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/**
 * Valida se uma password tem complexidade mínima (L1 da auditoria).
 *
 * Política atual: >= 12 caracteres, 1 maiúscula, 1 minúscula,
 * 1 número e 1 símbolo. (HIBP range API — k-anonymity — é opcional e
 * não integrado para não adicionar dependência de rede no registo.)
 */
export function isValidPassword(input: string): boolean {
  if (!input) return false;
  if (input.length < 12) return false;
  if (!/[A-Z]/.test(input)) return false;
  if (!/[a-z]/.test(input)) return false;
  if (!/[0-9]/.test(input)) return false;
  if (!/[^A-Za-z0-9]/.test(input)) return false;
  return true;
}

/**
 * Sanitiza objeto de social links — valida cada URL.
 */
export function sanitizeSocialLinks(
  social: Record<string, string | undefined>
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(social)) {
    if (value && typeof value === "string") {
      result[key] = sanitizeUrl(value);
    }
  }
  return result;
}


// ---------- Security Hashing ----------

/**
 * Hash SHA-256 um valor para logging sem expor PII em texto plano.
 * Usa Web Crypto API (compatível com Edge Runtime).
 */
export async function hashForLog(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- Suspicious Input Detection ----------

/** Padrões que indicam tentativas de ataque */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /<\s*script[^>]*>/i,       // <script> tags
  /\bon\w+\s*=/i,            // Event handlers (onclick=, onload=, etc.)
  /javascript\s*:/i,          // javascript: URIs
  /data\s*:\s*text\/html/i,  // data:text/html URIs
  /\bdocument\.\s*cookie/i,   // Accessing document.cookie
  /\b(alert|prompt|confirm)\s*\(/i, // Dialog functions
  /\beval\s*\(/i,            // eval()
  /\bFunction\s*\(/i,        // Function() constructor
  /--[\s]*$/,                 // SQL comment injection (defense in depth)
  /'\s*OR\s*'[^']*'\s*=/i,   // SQL OR injection attempts
  /%[0-9a-f]{2}/gi,           // URL-encoded characters (possible double encoding)
  /\\x[0-9a-f]{2}/gi,        // Hex escape sequences
  /\\(?:u[0-9a-f]{4})/gi,    // Unicode escapes
];

/**
 * Verifica se um input contém padrões suspeitos.
 * Retorna uma tupla [isSuspicious, matchedPatterns].
 */
export function detectSuspiciousInput(input: string): {
  suspicious: boolean;
  matchedPatterns: string[];
} {
  if (!input) return { suspicious: false, matchedPatterns: [] };

  const matchedPatterns: string[] = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(input)) {
      matchedPatterns.push(pattern.source);
    }
  }

  return {
    suspicious: matchedPatterns.length > 0,
    matchedPatterns,
  };
}
