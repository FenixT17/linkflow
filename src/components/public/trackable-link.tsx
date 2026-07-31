"use client";

import { ExternalLink } from "lucide-react";
import { LinkItem, Appearance } from "@/lib/types";
import { sanitizeUrl } from "@/lib/sanitize";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { getLiquidGlassClasses } from "@/lib/themes";

interface TrackableLinkProps {
  link: LinkItem;
  pageId: string;
  appearance: Appearance;
}

export function TrackableLink({ link, pageId, appearance }: TrackableLinkProps) {
  const theme = getLiquidGlassClasses();

  const handleClick = () => {
    fetch("/api/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, linkId: link.id }),
    }).catch((error) => {
      console.error("[TrackableLink] failed to record click:", error);
    });
  };

  return (
    <a
      href={sanitizeUrl(link.url)}
      target={link.newTab ? "_blank" : undefined}
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`group flex w-full items-center justify-between ${theme.linkClass} ${theme.linkHoverClass} transition-all duration-300`}
      style={{
        borderRadius: appearance.rounded,
        backdropFilter: `blur(${appearance.blur}px)`,
        opacity: (appearance.linkOpacity ?? 100) / 100,
        borderColor: appearance.borderColor || "rgba(255,255,255,0.06)",
        borderWidth: appearance.borderWidth !== undefined ? `${appearance.borderWidth}px` : undefined,
      }}
    >
      <span className="flex items-center gap-2.5 font-medium truncate pr-2 relative z-[1]" style={{ color: appearance.textColor }}>
        {link.icon && (
          <PlatformIcon
            platformId={link.icon}
            size={18}
            color={getPlatform(link.icon)?.color ?? appearance.accentColor}
          />
        )}
        <span className="truncate">{link.title || "Link"}</span>
      </span>
      <ExternalLink
        className={`h-4 w-4 shrink-0 relative z-[1] transition-colors duration-300 ${theme.linkIconClass}`}
        style={{
          color: appearance.accentColor || "rgba(255,255,255,0.3)",
        }}
      />
    </a>
  );
}
