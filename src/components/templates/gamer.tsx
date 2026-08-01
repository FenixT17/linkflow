import { Trophy, Gamepad2, Flame, Swords } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter, ProfileBadges } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

const ACCENT = "#f87171";

const GAMING_PLATFORMS = ["twitch", "youtube", "discord", "kick", "steam", "xbox", "playstation", "riotgames", "epicgames"];

/**
 * Gamer — Twitch, YouTube, Discord, estatísticas e conquistas.
 * Estrutura: header com tag de gamer + linha de estatísticas +
 * cartões de conquistas + plataformas de gaming.
 */
export function GamerTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const gamingLinks = links.filter((l) => GAMING_PLATFORMS.includes(l.icon || ""));
  const achievements = links.filter((l) => !GAMING_PLATFORMS.includes(l.icon || ""));

  const stats = [
    { icon: Trophy, label: "Conquistas", value: achievements.length },
    { icon: Gamepad2, label: "Plataformas", value: gamingLinks.length },
    { icon: Flame, label: "Links", value: links.length },
  ];

  return (
    <div
      className="relative min-h-dvh overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[110px]"
        style={{ backgroundColor: "rgba(248,113,113,0.2)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-md px-5 py-12">
        {/* Header do gamer */}
        <header className="flex flex-col items-center text-center">
          {appearance.showAvatar !== false && (
            <div className="relative">
              <div
                className="absolute -inset-1.5 rounded-full"
                style={{ background: "conic-gradient(from 180deg, #f87171, #a855f7, #f87171)" }}
                aria-hidden="true"
              />
              <TemplateAvatar
                src={profile.avatar}
                name={profile.displayName}
                size={96}
                badges={profile.badges}
                className="ring-4 ring-[var(--background,#0a0a0a)]"
              />
            </div>
          )}
          <span
            className="mt-4 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-widest"
            style={{ backgroundColor: "rgba(248,113,113,0.15)", color: ACCENT }}
          >
            <Swords className="h-3 w-3" /> Pro Player
          </span>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          <ProfileBadges badges={profile.badges} className="mt-1.5" />
          <p className="mt-1 font-mono text-xs" style={{ color: muted }}>
            @{profile.username}
          </p>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-3 max-w-sm text-sm leading-relaxed opacity-80">{profile.bio}</p>
          )}
          <div className="mt-4">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {/* Estatísticas */}
        <section className="mt-7 grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center">
              <s.icon className="mx-auto h-4 w-4" style={{ color: ACCENT }} />
              <p className="mt-1.5 text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: muted }}>
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* Plataformas de gaming */}
        {gamingLinks.length > 0 && (
          <section className="mt-8">
            <SectionLabel accent={ACCENT}>Jogar comigo</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {gamingLinks.map((link) => (
                <TrackedLink
                  key={link.id}
                  link={link}
                  pageId={profile.$id}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:scale-[1.02] hover:border-white/25"
                >
                  <PlatformIcon
                    platformId={link.icon || "twitch"}
                    size={18}
                    color={getPlatform(link.icon)?.color ?? ACCENT}
                  />
                  <span className="truncate text-sm font-medium">{link.title || "Seguir"}</span>
                </TrackedLink>
              ))}
            </div>
          </section>
        )}

        {/* Conquistas */}
        <section className="mt-8">
          <SectionLabel accent={ACCENT}>Conquistas</SectionLabel>
          {achievements.length === 0 && (
            <p className="mt-3 text-sm" style={{ color: muted }}>
              Sem conquistas desbloqueadas.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {achievements.map((link) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center transition-all hover:border-white/25"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "rgba(248,113,113,0.14)" }}
                >
                  <Trophy className="h-5 w-5" style={{ color: ACCENT }} />
                </div>
                <span className="text-xs font-semibold leading-tight">{link.title || "Conquista"}</span>
              </TrackedLink>
            ))}
          </div>
        </section>

        <TemplateFooter />
      </div>
    </div>
  );
}
