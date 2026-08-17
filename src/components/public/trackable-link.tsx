"use client";

import { ExternalLink } from "lucide-react";
import { LinkItem, Appearance } from "@/lib/types";
import { sanitizeUrl } from "@/lib/sanitize";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { getLiquidGlassClasses } from "@/lib/themes";
import { recordLinkClick } from "@/lib/utils";
import { hasStudyConsent } from "@/lib/study-consent";

interface TrackableLinkProps {
  link: LinkItem;
  idPagina: string;
  appearance: Appearance;
}

export function TrackableLink({ link, idPagina, appearance }: TrackableLinkProps) {
  const theme = getLiquidGlassClasses();

  const handleClick = () => {
    void recordLinkClick(idPagina, link.id, hasStudyConsent());
  };

  return (
    <a
      href={sanitizeUrl(link.url)}
      target={link.novaAba ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`group flex w-full items-center justify-between ${theme.linkClass} ${theme.linkHoverClass} transition-all duration-300`}
      style={{
        borderRadius: appearance.arredondado,
        backdropFilter: `blur(${appearance.desfoco}px)`,
        opacity: (appearance.opacidadeLinks ?? 100) / 100,
        borderColor: appearance.borderColor || "rgba(255,255,255,0.06)",
        borderWidth: appearance.borderWidth !== undefined ? `${appearance.borderWidth}px` : undefined,
      }}
    >
      <span className="flex items-center gap-2.5 font-medium truncate pr-2 relative z-[1]" style={{ color: appearance.corTexto }}>
        {link.icone && (
          <PlatformIcon
            platformId={link.icone}
            size={18}
            color={getPlatform(link.icone)?.color ?? appearance.corDestaque}
          />
        )}
        <span className="truncate">{link.titulo || "Link"}</span>
      </span>
      <ExternalLink
        className={`h-4 w-4 shrink-0 relative z-[1] transition-colors duration-300 ${theme.linkIconClass}`}
        style={{
          color: appearance.corDestaque || "rgba(255,255,255,0.3)",
        }}
      />
    </a>
  );
}
