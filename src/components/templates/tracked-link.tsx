"use client";

import { LinkItem } from "@/lib/types";
import { sanitizeUrl } from "@/lib/sanitize";
import { recordLinkClick } from "@/lib/utils";

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  link: LinkItem;
  pageId: string;
  children?: React.ReactNode;
}

/**
 * Âncora com tracking de cliques, usada por todos os templates.
 * Cada template controla o estilo via className; aqui só garantimos
 * URL saneada, abrir em nova aba (se configurado) e o POST /api/click.
 */
export function TrackedLink({ link, pageId, children, ...rest }: TrackedLinkProps) {
  const recordClick = () => {
    void recordLinkClick(pageId, link.id);
  };

  return (
    <a
      {...rest}
      href={sanitizeUrl(link.url)}
      target={link.newTab ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={recordClick}
    >
      {children ?? link.title}
    </a>
  );
}
