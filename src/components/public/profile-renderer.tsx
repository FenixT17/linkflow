"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Appearance, LinkItem, PageProfile } from "@/lib/types";
import { getLiquidGlassClasses } from "@/lib/themes";
import { ExternalLink, Share2 } from "lucide-react";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { sanitizeUrl } from "@/lib/sanitize";
import { useToast } from "@/context/ToastContext";
import { toHexColor, hexToRgba } from "@/lib/utils";

interface PublicProfileRendererProps {
  profile: PageProfile;
  links: LinkItem[];
  appearance: Appearance;
  showActions?: boolean;
  onRecordClick: () => void;
  previewUrl?: string;
}

export function PublicProfileRenderer({
  profile,
  links,
  appearance,
  showActions = true,
  onRecordClick,
  previewUrl,
}: PublicProfileRendererProps) {
  const theme = getLiquidGlassClasses();
  const { showToast } = useToast();
  const publicUrl = previewUrl || (typeof window !== "undefined" ? window.location.href : "#");

  const borderRadius = `${appearance.arredondado}px`;
  const backdropBlur = `blur(${appearance.desfoco}px)`;
  const opacidadeLinks = appearance.opacidadeLinks / 100;

  const safeBackground = appearance.corFundo || "#0a0a0a";
  const safeText = appearance.corTexto || "#fafafa";
  const safeAccent = appearance.corDestaque || safeText;
  const mutedForeground = hexToRgba(toHexColor(safeText), 0.6);

  const estiloBotao = appearance.estiloBotao;
  const linkStyle: React.CSSProperties = {
    borderRadius,
    backdropFilter: backdropBlur,
    opacity: opacidadeLinks,
  };

  if (estiloBotao === "solid") {
    linkStyle.backgroundColor = safeAccent;
    linkStyle.borderColor = "transparent";
    linkStyle.color = safeBackground;
  } else if (estiloBotao === "outline") {
    linkStyle.backgroundColor = "transparent";
    linkStyle.borderColor = safeAccent;
    linkStyle.color = safeAccent;
  } else if (estiloBotao === "soft") {
    linkStyle.backgroundColor = hexToRgba(toHexColor(safeAccent), 0.15);
    linkStyle.borderColor = "transparent";
    linkStyle.color = safeAccent;
  }

  return (
    <main
      className="relative min-h-dvh overflow-hidden bg-[var(--background)]"
      style={{
        backgroundColor: safeBackground,
        color: safeText,
        familiaFonte: appearance.familiaFonte,
        "--background": safeBackground,
        "--foreground": safeText,
        "--muted-foreground": mutedForeground,
      } as React.CSSProperties}
    >
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center px-4 sm:px-6 py-10 sm:py-20">
        <div
          className={`w-full overflow-hidden ${theme.cardClass}`}
          style={{ borderRadius, backdropFilter: backdropBlur }}
        >
          <div className="relative z-[1] flex flex-col items-center px-6 pb-8 pt-8">
            {appearance.mostrarAvatar !== false && (
              <div
                className={`h-24 w-24 rounded-full glass border-2 border-white/[var(--glass-border-opacity)]`}
                style={{ borderRadius: "50%" }}
              />
            )}
            <h1 className={`mt-4 text-2xl font-semibold tracking-tight text-center relative z-[1] ${theme.titleClass}`}>
              {profile.nomeExibicao}
            </h1>
            <p className={`text-sm relative z-[1] ${theme.usernameClass}`}>@{profile.nomeUtilizador}</p>
            {appearance.mostrarBiografia !== false && (
              <p className={`mt-3 text-center text-sm leading-relaxed relative z-[1] ${theme.bioClass}`}>
                {profile.biografia}
              </p>
            )}
            {showActions && (
              <div className="mt-5 flex gap-3 relative z-[1]">
                <button
                  onClick={() => {
                    if (!navigator.clipboard) {
                      showToast("Não foi possível copiar o link.", "error");
                      return;
                    }
                    navigator.clipboard
                      .writeText(publicUrl)
                      .then(() => showToast("Link copiado!", "success", 2500, "O URL foi copiado para a área de transferência."))
                      .catch(() => showToast("Não foi possível copiar o link.", "error"));
                  }}
                  className={theme.buttonClass}
                  aria-label="Partilhar"
                >
                  <Share2 className="h-4 w-4 relative z-[1]" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 w-full space-y-3">
          {links.length === 0 && (
            <div
              className={`p-6 text-center ${theme.cardClass}`}
              style={{ borderRadius, backdropFilter: backdropBlur }}
            >
              <p className={`text-sm relative z-[1] ${theme.bioClass}`}>Ainda não há links.</p>
            </div>
          )}
          {links.map((link) => (
            <a
              key={link.id}
              href={sanitizeUrl(link.url)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onRecordClick}
              className={`group flex w-full items-center justify-between ${theme.linkClass} ${theme.linkHoverClass} transition-all duration-300`}
              style={linkStyle}
            >
              <span className="flex items-center gap-2.5 font-medium truncate pr-2 relative z-[1]">
                {link.icone && (
                  <PlatformIcon
                    platformId={link.icone}
                    size={18}
                    color={getPlatform(link.icone)?.color ?? undefined}
                  />
                )}
                <span className="truncate">{link.titulo || "Link"}</span>
              </span>
              <ExternalLink className={`h-4 w-4 shrink-0 relative z-[1] ${theme.linkIconClass}`} />
            </a>
          ))}
        </div>

        <footer className="mt-12 text-center">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 text-xs font-medium ${theme.footerClass} transition-colors`}
          >
            <Logo size={16} className="brightness-150 contrast-125" />
            LinkFlow
          </Link>
        </footer>
      </div>
    </main>
  );
}
