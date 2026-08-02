import type { TemplateProps } from "./types";
import { TemplateAvatar, TemplateFooter, ProfileBadges, TemplateLinkPill } from "./shared";
import { ShareActions } from "@/components/public/share-actions";

/**
 * Página 2 — Toque violeta premium.
 * Fundo #0c0d12, avatar com anel roxo brilhante, botões em pílula com
 * borda roxa e ícones/texto em violeta vibrante (#8b5cf6).
 */
export function TemplateTwo({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = "#0c0d12";
  const text = "#f5f5f7";
  const muted = "rgba(245,245,247,0.5)";
  const violet = "#8b5cf6";
  const violetSoft = "#c4b5fd";
  const font = appearance.fontFamily || "Inter";

  return (
    <div
      className="relative min-h-dvh"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      {/* Botão de partilha no canto superior direito */}
      <div className="absolute right-5 top-5 z-10">
        <ShareActions publicUrl={publicUrl} />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-16">
        {/* Perfil centrado */}
        <header className="flex flex-col items-center text-center">
          {appearance.showAvatar !== false && (
            <TemplateAvatar
              src={profile.avatar}
              name={profile.displayName}
              size={88}
              badges={profile.badges}
              className="ring-2 ring-violet-500/40 shadow-[0_0_45px_-6px_rgba(139,92,246,0.55)]"
            />
          )}
          <h1 className="mt-6 text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          <ProfileBadges badges={profile.badges} className="mt-2" />
          <p className="mt-1 text-sm font-medium" style={{ color: muted }}>
            @{profile.username}
          </p>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: muted }}>
              {profile.bio}
            </p>
          )}
        </header>

        {/* Links em pílulas roxas */}
        <nav className="mt-10 flex flex-col space-y-3" aria-label="Links">
          {links.length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: muted }}>
              Ainda não há links.
            </p>
          )}
          {links.map((link) => (
            <TemplateLinkPill
              key={link.id}
              link={link}
              pageId={profile.$id}
              iconColor={violet}
              textColor={violetSoft}
              iconBg="rgba(139,92,246,0.12)"
              chevronColor={violet}
              className="bg-[#131318] ring-1 ring-violet-500/25 shadow-[0_10px_30px_-12px_rgba(139,92,246,0.25)] hover:bg-[#181824] hover:ring-violet-500/45"
            />
          ))}
        </nav>

        <TemplateFooter textColor={muted} />
      </div>
    </div>
  );
}
