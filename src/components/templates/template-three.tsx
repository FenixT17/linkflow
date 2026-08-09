import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { sanitizeMediaUrl } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { TemplateAvatar, TemplateFooter, ProfileBadges } from "./shared";
import { TrackedLink } from "./tracked-link";
import type { TemplateProps } from "./types";

/**
 * Página 3 — Liquid Glass.
 *
 * Banner de largura total, avatar sobreposto e links em barras de vidro
 * translúcido. Todos os dados continuam a vir da página e dos links reais.
 */
export function TemplateThree({ profile, links, appearance, publicUrl }: TemplateProps) {
  const background = appearance.backgroundColor || "#11161f";
  const text = appearance.textColor || "#f7f8fb";
  const accent = appearance.accentColor || "#dbe4f5";
  const muted = "rgba(235,240,250,0.66)";
  const glassOpacity = Math.min(1, Math.max(0.04, (appearance.glassOpacity ?? 35) / 100));
  const glassBlur = Math.min(48, Math.max(8, appearance.glassBlur ?? 25));
  const glassStrength = Math.min(1, Math.max(0, (appearance.glassStrength ?? 50) / 100));
  const borderColor = appearance.borderColor || `rgba(225,235,255,${0.14 + glassStrength * 0.14})`;
  const borderWidth = Math.min(3, Math.max(1, appearance.borderWidth ?? 1));
  const radius = Math.min(36, Math.max(16, appearance.rounded ?? 20));
  const font = appearance.fontFamily || "Inter";
  const safeBanner = profile.banner
    ? (() => {
        return sanitizeMediaUrl(profile.banner);
      })()
    : "";

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ backgroundColor: background, color: text, fontFamily: font }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(160,180,220,0.18), transparent 38%), radial-gradient(circle at 0% 70%, rgba(80,100,140,0.12), transparent 34%)",
        }}
        aria-hidden="true"
      />

      <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
        <ShareActions publicUrl={publicUrl} />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-3 py-7 sm:px-6 sm:py-12">
        <div
          className="relative overflow-hidden shadow-[0_30px_90px_-40px_rgba(0,0,0,0.95)]"
          style={{
            borderRadius: radius,
            border: `${borderWidth}px solid ${borderColor}`,
            backgroundColor: `rgba(16,22,32,${Math.min(0.9, glassOpacity + 0.34)})`,
            backdropFilter: `blur(${glassBlur}px)`,
          }}
        >
          <div
            className="relative h-48 overflow-hidden bg-[linear-gradient(135deg,#98a6bf_0%,#4f5b72_38%,#111722_72%,#303b50_100%)] sm:h-56"
            role={!safeBanner ? "img" : undefined}
            aria-label={!safeBanner ? `Banner padrão de ${profile.displayName}` : undefined}
          >
            {safeBanner && (
              <Image
                src={safeBanner}
                alt={`Banner de ${profile.displayName}`}
                fill
                sizes="(max-width: 640px) 100vw, 576px"
                unoptimized
                className="object-cover"
                priority
              />
            )}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(18,24,36,0.08), rgba(10,14,22,0.52)), linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.18), transparent 52%)",
              }}
              aria-hidden="true"
            />
            {!safeBanner && (
              <div
                className="absolute inset-0 opacity-70"
                style={{
                  background:
                    "linear-gradient(156deg, transparent 28%, rgba(225,235,255,0.32) 29%, transparent 43%), linear-gradient(18deg, transparent 42%, rgba(220,230,250,0.2) 43%, transparent 59%)",
                }}
                aria-hidden="true"
              />
            )}
          </div>

          <div className="relative px-5 pb-8 sm:px-8 sm:pb-10">
            {appearance.showAvatar !== false && (
              <div className="-mt-14 flex justify-center sm:-mt-16">
                <TemplateAvatar
                  src={profile.avatar}
                  name={profile.displayName}
                  size={112}
                  badges={profile.badges}
                  className="ring-[3px] ring-[#aebbd0]/80 shadow-[0_12px_38px_-8px_rgba(0,0,0,0.9)]"
                />
              </div>
            )}

            <header className={cn("text-center", appearance.showAvatar !== false ? "mt-5" : "pt-6")}>
              <h1
                className="text-[clamp(1.5rem,5vw,2rem)] font-bold tracking-[-0.03em]"
                style={{ fontSize: appearance.fontSize ? `${Math.min(24, Math.max(18, appearance.fontSize * 1.45))}px` : undefined }}
              >
                {profile.displayName}
              </h1>
              <ProfileBadges badges={profile.badges} className="mt-2" />
              <p className="mt-1 text-sm font-medium" style={{ color: muted }}>
                @{profile.username}
              </p>
              {appearance.showBio !== false && profile.bio && (
                <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed" style={{ color: muted }}>
                  {profile.bio}
                </p>
              )}
            </header>

            <nav className="mt-8 flex flex-col gap-3" aria-label="Links">
              {links.length === 0 && (
                <p className="py-8 text-center text-sm" style={{ color: muted }}>
                  Ainda não há links.
                </p>
              )}
              {links.map((link) => (
                <TrackedLink
                  key={link.id}
                  link={link}
                  pageId={profile.$id}
                  className="group relative flex min-h-[58px] w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgba(205,220,245,0.8)] active:scale-[0.985]"
                  style={{
                    color: text,
                    border: `${borderWidth}px solid ${borderColor}`,
                    backgroundColor: `rgba(255,255,255,${glassOpacity})`,
                    backdropFilter: `blur(${glassBlur}px)`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)",
                  }}
                >
                  <span
                    className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08]"
                    aria-hidden="true"
                  >
                    <PlatformIcon platformId={link.icon || "link"} size={20} color={accent} />
                  </span>
                  <span className="relative z-[1] min-w-0 flex-1 truncate text-center text-sm font-medium tracking-[0.01em]">
                    {link.title || "Link"}
                  </span>
                  <ChevronRight
                    className="relative z-[1] h-5 w-5 shrink-0 text-white/65 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                  <span
                    className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-70"
                    aria-hidden="true"
                  />
                </TrackedLink>
              ))}
            </nav>
          </div>
        </div>

        <TemplateFooter textColor={muted} />
      </div>
    </div>
  );
}
