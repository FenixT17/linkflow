import Image from "next/image";
import { Play, Clapperboard } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { sanitizeUrl } from "@/lib/sanitize";

const ACCENT = "#a78bfa";
const ACCENT_SOFT = "rgba(167,139,250,0.14)";

/**
 * Creator — destaque enorme para vídeo, botões grandes, redes sociais
 * visíveis e secção "Último vídeo". Estrutura de streamer/YouTuber.
 */
export function CreatorTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";

  const socialLinks = links.filter((l) => l.icon && getPlatform(l.icon)?.category === "social");
  const featured = links.find((l) => l.image) ?? links[0];
  const rest = links.filter((l) => l.id !== featured?.id);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      {/* glow de fundo */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[100px]"
        style={{ backgroundColor: "rgba(167,139,250,0.25)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-md px-5 py-12">
        {/* Header com avatar grande + badge */}
        <header className="flex flex-col items-center text-center">
          <div className="relative">
            <div
              className="absolute -inset-1.5 rounded-full"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #22d3ee)` }}
              aria-hidden="true"
            />
            {appearance.showAvatar !== false && (
              <TemplateAvatar
                src={profile.avatar}
                name={profile.displayName}
                size={96}
                className="ring-4 ring-[var(--background,#0a0a0a)]"
              />
            )}
          </div>
          <span
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: ACCENT_SOFT, color: ACCENT }}
          >
            <Clapperboard className="h-3 w-3" /> Criador
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          <p className="mt-1 text-sm opacity-60">@{profile.username}</p>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-3 max-w-sm text-sm leading-relaxed opacity-80">{profile.bio}</p>
          )}
          <div className="mt-4">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {/* Redes sociais visíveis */}
        {socialLinks.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            {socialLinks.map((link) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                aria-label={link.title || getPlatform(link.icon)?.name || "Rede social"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-all hover:scale-105 hover:border-white/25"
              >
                <PlatformIcon
                  platformId={link.icon || "website"}
                  size={20}
                  color={getPlatform(link.icon)?.color ?? ACCENT}
                />
              </TrackedLink>
            ))}
          </div>
        )}

        {/* Último vídeo — hero */}
        {featured && (
          <section className="mt-8">
            <SectionLabel accent={ACCENT}>Último vídeo</SectionLabel>
            <TrackedLink
              link={featured}
              pageId={profile.$id}
              className="group mt-3 block overflow-hidden rounded-2xl border border-white/10"
              style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
            >
              <div className="relative aspect-video w-full overflow-hidden">
                {featured.image ? (
                  <Image
                    src={sanitizeUrl(featured.image)}
                    alt={featured.title || "Vídeo"}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${ACCENT_SOFT}, rgba(34,211,238,0.08))` }}
                  >
                    <Play className="h-10 w-10" style={{ color: ACCENT }} fill={ACCENT} />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className="absolute bottom-3 left-3 right-3 text-sm font-semibold text-white">
                  {featured.title || "Ver vídeo"}
                </span>
              </div>
            </TrackedLink>
          </section>
        )}

        {/* Botões grandes */}
        {rest.length > 0 && (
          <section className="mt-8 space-y-3">
            <SectionLabel accent={ACCENT}>Mais links</SectionLabel>
            <div className="mt-3 space-y-3">
              {rest.map((link) => (
                <TrackedLink
                  key={link.id}
                  link={link}
                  pageId={profile.$id}
                  className="flex items-center justify-between rounded-2xl px-5 py-4 text-sm font-semibold transition-all hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`,
                    boxShadow: `0 8px 32px ${ACCENT_SOFT}`,
                  }}
                >
                  <span className="flex items-center gap-3">
                    {link.icon && (
                      <PlatformIcon platformId={link.icon} size={18} color="#ffffff" />
                    )}
                    <span className="text-white">{link.title || "Link"}</span>
                  </span>
                  <Play className="h-4 w-4 text-white/70" fill="white" />
                </TrackedLink>
              ))}
            </div>
          </section>
        )}

        {links.length === 0 && (
          <p className="mt-10 py-8 text-center text-sm opacity-50">Ainda não há links.</p>
        )}

        <TemplateFooter />
      </div>
    </div>
  );
}
