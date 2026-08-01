import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  Crown,
  Handshake,
} from "lucide-react";
import type { BadgeId } from "./types";

/** Como desbloquear cada badge. */
export type BadgeUnlock = "donation" | "application" | "plan" | "team";

export interface BadgeMeta {
  id: BadgeId;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Cor de destaque (hex) usada nos cartões e pormenores do dashboard */
  accent: string;
  /** Classes tailwind de gradiente para o cartão */
  gradient: string;
  unlock: BadgeUnlock;
  /** Preço em euros (apenas para unlock === "donation") */
  price?: number;
}

/**
 * Registo completo de badges do LinkFlow.
 *
 * - verified:  insígnia de verificado roxo junto à foto de perfil (doação de 10€).
 * - staff:      candidatura ao staff (revisão manual).
 * - supporter:  qualquer doação (concedida automaticamente com a verified).
 * - early:      concedida pela equipa (Early Adopter).
 * - pro:        subscrição com plano pago (automática pelo plano da conta).
 * - partner:    concedida pela equipa (parceiro oficial).
 */
export const BADGES: BadgeMeta[] = [
  {
    id: "verified",
    name: "Verificado",
    description: "Insígnia de verificado roxo junto à foto de perfil. Desbloqueada com uma doação de 10€.",
    icon: BadgeCheck,
    accent: "#a855f7",
    gradient: "from-purple-500/30 via-fuchsia-500/15 to-purple-700/25",
    unlock: "donation",
    price: 10,
  },
  {
    id: "staff",
    name: "Staff",
    description: "Faça parte da equipa do LinkFlow. Candidatura sujeita a revisão.",
    icon: ShieldCheck,
    accent: "#38bdf8",
    gradient: "from-sky-500/30 via-blue-500/15 to-indigo-700/25",
    unlock: "application",
  },
  {
    id: "supporter",
    name: "Apoiante",
    description: "Apoiou o LinkFlow com uma doação. Concedida automaticamente com o Verificado.",
    icon: HeartHandshake,
    accent: "#34d399",
    gradient: "from-emerald-500/30 via-teal-500/15 to-green-700/25",
    unlock: "donation",
  },
  {
    id: "early",
    name: "Early Adopter",
    description: "Esteve connosco desde o início. Concedida pela equipa.",
    icon: Sparkles,
    accent: "#fbbf24",
    gradient: "from-amber-500/30 via-yellow-500/15 to-orange-700/25",
    unlock: "team",
  },
  {
    id: "pro",
    name: "Pro",
    description: "Subscrição ativa com o plano Pro. Concedida automaticamente.",
    icon: Crown,
    accent: "#f59e0b",
    gradient: "from-orange-500/30 via-amber-500/15 to-yellow-700/25",
    unlock: "plan",
  },
  {
    id: "partner",
    name: "Parceiro",
    description: "Parceiro oficial do LinkFlow. Concedida pela equipa.",
    icon: Handshake,
    accent: "#f472b6",
    gradient: "from-pink-500/30 via-rose-500/15 to-red-700/25",
    unlock: "team",
  },
];

export const BADGE_BY_ID: Record<BadgeId, BadgeMeta> = Object.fromEntries(
  BADGES.map((b) => [b.id, b])
) as Record<BadgeId, BadgeMeta>;

export function isBadgeId(value: unknown): value is BadgeId {
  return typeof value === "string" && value in BADGE_BY_ID;
}

/** Badges que o utilizador pode desbloquear sozinho na aba Badges. */
export const SELF_SERVICE_BADGES: BadgeId[] = ["verified", "staff"];

/** Preço fixo da doação que desbloqueia o Verificado (em euros). */
export const VERIFIED_DONATION_PRICE = 10;
