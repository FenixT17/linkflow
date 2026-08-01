import type { Appearance, LinkItem, PageProfile } from "@/lib/types";

/**
 * Props comuns a todos os templates de página pública.
 * Cada template é um componente independente que renderiza a sua própria
 * estrutura, respeitando os dados reais do utilizador.
 */
export interface TemplateProps {
  profile: PageProfile & { $id: string };
  /** Links visíveis e ativos (já filtrados) */
  links: LinkItem[];
  appearance: Appearance;
  publicUrl: string;
}
