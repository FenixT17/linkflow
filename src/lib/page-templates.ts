import type { LucideIcon } from "lucide-react";
import { Smartphone, Palette } from "lucide-react";
import type { PageTemplateId } from "./types";

/**
 * Registro de templates de página do LinkFlow.
 *
 * Cada template é um layout completamente diferente (não apenas cores) e é
 * renderizado pelo componente correspondente em components/templates/.
 *
 * Para adicionar um novo template no futuro:
 *   1. Criar o componente em components/templates/ (ex: template-three.tsx);
 *   2. Adicionar o novo id ao tipo PageTemplateId em lib/types.ts;
 *   3. Registar aqui uma nova entrada PAGE_TEMPLATES;
 *   4. Mapear o id no switcher components/templates/index.tsx.
 * Nada mais precisa de mudar — a arquitetura é extensível.
 */
export type TemplateThumb = "template1" | "template2";

export interface PageTemplateMeta {
  id: PageTemplateId;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Cor de destaque (hex) usada nos thumbnails e pormenores do dashboard */
  accent: string;
  /** Classes tailwind de gradiente para a moldura do thumbnail */
  gradient: string;
  /** Estrutura da miniatura de pré-visualização */
  thumb: TemplateThumb;
}

/** Template padrão para novos utilizadores — Página 1. */
export const DEFAULT_PAGE_TEMPLATE: PageTemplateId = "template1";

export const PAGE_TEMPLATES: PageTemplateMeta[] = [
  {
    id: "template1",
    name: "Página 1",
    description: "Clássico premium: avatar com brilho suave, perfil centrado e botões em pílula discretos.",
    icon: Smartphone,
    accent: "#e4e4e7",
    gradient: "from-zinc-500/25 via-zinc-400/10 to-zinc-700/20",
    thumb: "template1",
  },
  {
    id: "template2",
    name: "Página 2",
    description: "Toque violeta: bordas, ícones e destaques em roxo vibrante sobre fundo profundo.",
    icon: Palette,
    accent: "#8b5cf6",
    gradient: "from-violet-500/30 via-purple-500/15 to-fuchsia-700/25",
    thumb: "template2",
  },
];

export const PAGE_TEMPLATE_BY_ID: Record<PageTemplateId, PageTemplateMeta> = Object.fromEntries(
  PAGE_TEMPLATES.map((t) => [t.id, t])
) as Record<PageTemplateId, PageTemplateMeta>;

export function isPageTemplate(value: unknown): value is PageTemplateId {
  return typeof value === "string" && value in PAGE_TEMPLATE_BY_ID;
}
