import type { LucideIcon } from "lucide-react";
import {
  LayoutTemplate,
  Clapperboard,
  Briefcase,
  Store,
  Palette,
  Camera,
  Music,
  UtensilsCrossed,
  Ticket,
  GraduationCap,
  Gamepad2,
  Code2,
} from "lucide-react";
import type { PageType } from "./types";

/**
 * Archetype visual usado na miniatura do cartão (mockup de telemóvel).
 * Cada template tem uma estrutura de thumbnail distinta.
 */
export type ThumbLayout =
  | "minimal"
  | "creator"
  | "business"
  | "store"
  | "portfolio"
  | "photographer"
  | "music"
  | "restaurant"
  | "event"
  | "resume"
  | "gamer"
  | "developer";

export interface PageTemplateMeta {
  id: PageType;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Cor de destaque (hex) usada nos thumbnails e pormenores do dashboard */
  accent: string;
  /** Classes tailwind de gradiente para a moldura do thumbnail */
  gradient: string;
  /** Estrutura da miniatura de pré-visualização */
  thumb: ThumbLayout;
}

export const DEFAULT_PAGE_TYPE: PageType = "minimal";

export const PAGE_TEMPLATES: PageTemplateMeta[] = [
  {
    id: "minimal",
    name: "Minimalista",
    description: "Avatar pequeno, links simples e muito espaço branco. Visual limpo.",
    icon: LayoutTemplate,
    accent: "#e4e4e7",
    gradient: "from-zinc-500/25 via-zinc-400/10 to-zinc-700/20",
    thumb: "minimal",
  },
  {
    id: "creator",
    name: "Creator",
    description: "Destaque enorme para vídeo, botões grandes e redes sociais visíveis.",
    icon: Clapperboard,
    accent: "#a78bfa",
    gradient: "from-violet-500/30 via-fuchsia-500/15 to-purple-700/25",
    thumb: "creator",
  },
  {
    id: "business",
    name: "Empresarial",
    description: "Logótipo, descrição, serviços e contacto num layout profissional.",
    icon: Briefcase,
    accent: "#60a5fa",
    gradient: "from-blue-500/30 via-sky-500/15 to-indigo-700/25",
    thumb: "business",
  },
  {
    id: "store",
    name: "Loja Online",
    description: "Produtos em cartões, preços, botão Comprar e promoções.",
    icon: Store,
    accent: "#34d399",
    gradient: "from-emerald-500/30 via-teal-500/15 to-green-700/25",
    thumb: "store",
  },
  {
    id: "portfolio",
    name: "Portfólio",
    description: "Grelha de projetos, imagens, categorias e botão Ver Projeto.",
    icon: Palette,
    accent: "#818cf8",
    gradient: "from-indigo-500/30 via-violet-500/15 to-blue-700/25",
    thumb: "portfolio",
  },
  {
    id: "photographer",
    name: "Fotógrafo",
    description: "Galeria em destaque, slideshow e mosaico de fotografias.",
    icon: Camera,
    accent: "#fbbf24",
    gradient: "from-amber-500/25 via-yellow-500/10 to-orange-700/25",
    thumb: "photographer",
  },
  {
    id: "music",
    name: "Música / Artista",
    description: "Player, Spotify, Apple Music, YouTube e próximos concertos.",
    icon: Music,
    accent: "#4ade80",
    gradient: "from-green-500/30 via-emerald-500/15 to-lime-700/25",
    thumb: "music",
  },
  {
    id: "restaurant",
    name: "Restaurante",
    description: "Menu, reservas, localização e delivery num só lugar.",
    icon: UtensilsCrossed,
    accent: "#fb923c",
    gradient: "from-orange-500/30 via-amber-500/15 to-red-700/25",
    thumb: "restaurant",
  },
  {
    id: "event",
    name: "Evento",
    description: "Contagem decrescente, data, bilhetes e programação.",
    icon: Ticket,
    accent: "#f472b6",
    gradient: "from-pink-500/30 via-rose-500/15 to-red-700/25",
    thumb: "event",
  },
  {
    id: "resume",
    name: "Currículo / CV",
    description: "Experiência, competências, educação, certificações e contacto.",
    icon: GraduationCap,
    accent: "#2dd4bf",
    gradient: "from-teal-500/30 via-cyan-500/15 to-sky-700/25",
    thumb: "resume",
  },
  {
    id: "gamer",
    name: "Gamer",
    description: "Twitch, YouTube, Discord, estatísticas e conquistas.",
    icon: Gamepad2,
    accent: "#f87171",
    gradient: "from-red-500/30 via-rose-500/15 to-purple-700/25",
    thumb: "gamer",
  },
  {
    id: "developer",
    name: "Desenvolvedor",
    description: "GitHub, projetos, stack tecnológica e Open to Work.",
    icon: Code2,
    accent: "#22d3ee",
    gradient: "from-cyan-500/30 via-sky-500/15 to-blue-700/25",
    thumb: "developer",
  },
];

export const PAGE_TEMPLATE_BY_ID: Record<PageType, PageTemplateMeta> = Object.fromEntries(
  PAGE_TEMPLATES.map((t) => [t.id, t])
) as Record<PageType, PageTemplateMeta>;

export function isPageType(value: unknown): value is PageType {
  return typeof value === "string" && value in PAGE_TEMPLATE_BY_ID;
}
