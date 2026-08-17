import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, ShieldCheck, HeartHandshake, Sparkles, Crown, Handshake, ChevronDown } from "lucide-react";
import { sanitizeMediaUrl } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { BADGE_BY_ID, isBadgeId } from "@/lib/badges";
import { TrackedLink } from "./tracked-link";
import { PlatformIcon } from "@/components/ui/platform-icon";
import type { LinkItem } from "@/lib/types";

const BADGE_ICONS: Record<string, typeof BadgeCheck> = {
  verified: BadgeCheck,
  staff: ShieldCheck,
  supporter: HeartHandshake,
  early: Sparkles,
  pro: Crown,
  partner: Handshake,
};

/** Avatar com imagem saneada ou inicial como fallback. Exibe o visto verificado roxo sobre a foto quando a badge verified está ativa. */
export function TemplateAvatar({
  src,
  name,
  size = 96,
  className,
  badges,
}: {
  src?: string;
  name: string;
  size?: number;
  className?: string;
  badges?: string[];
}) {
  const verified = Array.isArray(badges) && badges.includes("verified");
  const safeSrc = src
    ? (() => {
        const sanitized = sanitizeMediaUrl(src);
        return sanitized;
      })()
    : "";
  return (
    <div
      className={cn("relative shrink-0 rounded-full", className)}
      style={{ width: size, height: size }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        {safeSrc ? (
          <Image
            src={safeSrc}
            alt={`Foto de perfil de ${name}`}
            width={size}
            height={size}
            unoptimized
            className="object-cover w-full h-full"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/[0.06] text-white/70">
            <span className="font-semibold" style={{ fontSize: size * 0.4 }}>
              {name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
        )}
      </div>
      {verified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-purple-500 ring-2 ring-[#0a0a0a] shadow-lg"
          style={{ width: Math.max(18, size * 0.28), height: Math.max(18, size * 0.28) }}
          aria-label="Verificado"
          title="Verificado"
        >
          <BadgeCheck className="h-3/5 w-3/5 text-white" strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

/** Linha de badges da página pública (por baixo do nome). Renderiza apenas as badges ativas. */
export function ProfileBadges({ badges, className }: { badges?: string[]; className?: string }) {
  const active = (Array.isArray(badges) ? badges : []).filter(isBadgeId);
  if (active.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-1.5", className)}>
      {active.map((id) => {
        const meta = BADGE_BY_ID[id];
        const Icon = BADGE_ICONS[id] ?? BadgeCheck;
        return (
          <span
            key={id}
            title={meta.name}
            aria-label={meta.name}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full"
            style={{ backgroundColor: `${meta.accent}26`, color: meta.accent }}
          >
            <Icon className="h-3 w-3" strokeWidth={2.5} />
          </span>
        );
      })}
    </div>
  );
}

/** Rótulo de secção com barra de destaque */
export function SectionLabel({
  children,
  accent,
  className,
}: {
  children: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className="h-4 w-1 rounded-full"
        style={{ backgroundColor: accent || "currentColor" }}
      />
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
        {children}
      </span>
    </div>
  );
}

/**
 * Botão em pílula de link — estrutura partilhada entre templates.
 * Cada template controla cores/bordas via props (sem duplicar lógica).
 * Ícone circular à esquerda, título centrado, chevron à direita.
 */
export function TemplateLinkPill({
  link,
  idPagina,
  iconColor,
  corTexto,
  iconBg = "rgba(255,255,255,0.06)",
  chevronColor,
  className,
}: {
  link: LinkItem;
  idPagina: string;
  iconColor: string;
  corTexto?: string;
  iconBg?: string;
  chevronColor?: string;
  className?: string;
}) {
  return (
    <TrackedLink
      link={link}
      idPagina={idPagina}
      className={cn(
        "group flex w-full items-center gap-3 rounded-full px-4 py-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg }}
        aria-hidden="true"
      >
        <PlatformIcon
          platformId={link.icone ?? "link"}
          size={16}
          color={iconColor}
        />
      </span>
      <span
        className="flex-1 truncate text-center text-sm font-medium"
        style={{ color: corTexto ?? iconColor }}
      >
        {link.titulo || "Link"}
      </span>
      <ChevronDown
        className="h-4 w-4 shrink-0 opacity-60 transition-transform duration-200 group-hover:translate-y-0.5"
        style={{ color: chevronColor ?? iconColor }}
        aria-hidden="true"
      />
    </TrackedLink>
  );
}

/** Rodapé LinkFlow consistente em todos os templates */
export function TemplateFooter({ corTexto }: { corTexto?: string }) {
  return (
    <footer className="pt-14 pb-10 text-center">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-medium opacity-60 transition-opacity hover:opacity-100"
        style={{ color: corTexto }}
      >
        <Logo size={14} className="brightness-150 contrast-125" />
        LinkFlow
      </Link>
    </footer>
  );
}
