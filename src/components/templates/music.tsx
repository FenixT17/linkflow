import { Play, Pause, Disc3, CalendarDays } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

const ACCENT = "#4ade80";

const MUSIC_PLATFORMS = ["spotify", "applemusic", "youtube", "soundcloud", "deezer", "tidal", "bandcamp"];

/**
 * Música / Artista — player em destaque, plataformas de streaming e
 * próximos concertos. Estrutura de página de artista.
 */
export function MusicTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const streamingLinks = links.filter((l) => MUSIC_PLATFORMS.includes(l.icon || ""));
  const track = links[0];
  const concerts = links.filter((l) => l.id !== track?.id);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full blur-[110px]"
        style={{ backgroundColor: "rgba(74,222,128,0.22)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-md px-5 py-12">
        {/* Header do artista */}
        <header className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-emerald-400/30 blur-md" aria-hidden="true" />
            {appearance.showAvatar !== false && (
              <TemplateAvatar
                src={profile.avatar}
                name={profile.displayName}
                size={72}
                className="ring-2 ring-emerald-400/40"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
              Artista
            </p>
            <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight">{profile.displayName}</h1>
            <p className="truncate text-xs" style={{ color: muted }}>
              @{profile.username}
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {appearance.showBio !== false && profile.bio && (
          <p className="mt-4 text-sm leading-relaxed" style={{ color: muted }}>
            {profile.bio}
          </p>
        )}

        {/* Player */}
        {track && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-white/10" style={{ backgroundColor: "rgba(74,222,128,0.08)" }}>
            <TrackedLink
              link={track}
              pageId={profile.$id}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-white/[0.04]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: ACCENT }}>
                <Play className="h-5 w-5 text-[#04120c]" fill="#04120c" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{track.title || "Música em destaque"}</p>
                <p className="truncate text-xs" style={{ color: muted }}>
                  {track.description || profile.displayName}
                </p>
              </div>
              <Pause className="h-4 w-4 opacity-40" aria-hidden="true" />
            </TrackedLink>
            {/* Barra de progresso decorativa */}
            <div className="h-1 w-full" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
              <div className="h-full w-1/3" style={{ backgroundColor: ACCENT }} />
            </div>
          </section>
        )}

        {/* Plataformas de streaming */}
        {streamingLinks.length > 0 && (
          <section className="mt-6">
            <SectionLabel accent={ACCENT}>Ouvir agora</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {streamingLinks.map((link) => (
                <TrackedLink
                  key={link.id}
                  link={link}
                  pageId={profile.$id}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:scale-[1.02] hover:border-white/25"
                >
                  <PlatformIcon
                    platformId={link.icon || "spotify"}
                    size={18}
                    color={getPlatform(link.icon)?.color ?? ACCENT}
                  />
                  <span className="truncate text-sm font-medium">{link.title || "Ouvir"}</span>
                </TrackedLink>
              ))}
            </div>
          </section>
        )}

        {/* Próximos concertos */}
        <section className="mt-8">
          <SectionLabel accent={ACCENT}>Próximos concertos</SectionLabel>
          {concerts.length === 0 && (
            <p className="mt-3 text-sm" style={{ color: muted }}>
              Sem concertos agendados.
            </p>
          )}
          <div className="mt-3 space-y-2.5">
            {concerts.map((link) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:border-white/25"
              >
                <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>
                  <Disc3 className="h-4 w-4" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{link.title || "Concerto"}</p>
                  {link.description && (
                    <p className="truncate text-xs" style={{ color: muted }}>
                      {link.description}
                    </p>
                  )}
                </div>
                <CalendarDays className="h-4 w-4 shrink-0 opacity-40" />
              </TrackedLink>
            ))}
          </div>
        </section>

        <TemplateFooter />
      </div>
    </div>
  );
}
