"use client";

import { LinkItem } from "@/lib/types";
import { sanitizeUrl } from "@/lib/sanitize";
import { recordLinkClick } from "@/lib/utils";
import { hasStudyConsent } from "@/lib/study-consent";

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  link: LinkItem;
  idPagina: string;
  children?: React.ReactNode;
}

/**
 * Âncora com tracking de cliques, usada por todos os templates.
 * Cada template controla o estilo via className; aqui só garantimos
 * URL saneada, abrir em nova aba (se configurado) e o POST /api/click.
 */
export function TrackedLink({ link, idPagina, children, ...rest }: TrackedLinkProps) {
  const recordClick = () => {
    void recordLinkClick(idPagina, link.id, hasStudyConsent());
  };

  return (
    <a
      {...rest}
      href={sanitizeUrl(link.url)}
      target={link.novaAba ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={recordClick}
    >
      {children ?? link.titulo}
    </a>
  );
}
