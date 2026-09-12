import { BADGE_BY_ID, isBadgeId, type BadgeUnlock } from "./badges";

/**
 * Regras de concessão de badges — lógica pura, sem I/O.
 *
 * As regras são derivadas do metadado `unlock` do registo de badges
 * (`src/lib/badges.ts`), para que adicionar uma badge nova não exija duplicar
 * condições espalhadas pelo código:
 *
 * - `team`        → ninguém concede a si próprio (early, partner).
 * - `application` → exige candidatura aprovada por um revisor confiável. A
 *                   badge NUNCA é persistida no documento `pages` (esse campo
 *                   é editável pelo utilizador): é derivada no servidor a
 *                   partir da candidatura aprovada.
 * - `plan`        → exige plano pago (lido do registo `users`, não do body).
 * - `donation`    → self-service (verified, supporter — doação simulada).
 *
 * Esta função é a única fonte de verdade: a rota `/api/badges` limita-se a
 * reunir o contexto (plano, candidatura) e a aplicar a decisão. O cliente
 * nunca decide nem escreve — a coleção `pages` não aceita `emblemas` pelo
 * proxy (ver ALLOWED_FIELDS).
 */

export interface BadgeGrantContext {
  /** Plano atual da conta, lido do registo `users` no servidor. */
  plan: string;
  /** True quando existe candidatura ao staff aprovada por um revisor confiável. */
  staffApproved: boolean;
}

export type BadgeGrantDecision =
  /** Permitido. `persist: false` → badge derivada, nada a escrever em `pages`. */
  | { allowed: true; persist: boolean }
  | { allowed: false; error: string };

const UNKNOWN_BADGE_ERROR = "Badge desconhecida.";

export function decideBadgeGrant(
  badgeId: unknown,
  context: BadgeGrantContext,
): BadgeGrantDecision {
  if (!isBadgeId(badgeId)) {
    return { allowed: false, error: UNKNOWN_BADGE_ERROR };
  }

  const unlock: BadgeUnlock = BADGE_BY_ID[badgeId].unlock;

  switch (unlock) {
    case "team":
      return { allowed: false, error: "Esta badge é concedida apenas pela equipa." };

    case "application":
      return context.staffApproved
        ? { allowed: true, persist: false }
        : {
            allowed: false,
            error: "A badge Staff só é concedida após aprovação da candidatura.",
          };

    case "plan":
      return context.plan !== "free"
        ? { allowed: true, persist: true }
        : { allowed: false, error: "A badge Pro requer um plano pago." };

    case "donation":
      return { allowed: true, persist: true };

    default:
      return { allowed: false, error: UNKNOWN_BADGE_ERROR };
  }
}

/**
 * Normaliza a lista de badges persistida em `pages.emblemas`.
 *
 * - Remove entradas que não são ids conhecidos (o campo é editável pelo
 *   utilizador e pode conter lixo de versões antigas).
 * - Remove `staff`: é sempre derivada da candidatura aprovada, nunca aceite
 *   do documento (evita auto-atribuição por edição direta do documento).
 */
export function normalizePersistedBadges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || value === "staff" || !isBadgeId(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
