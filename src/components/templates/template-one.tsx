import type { TemplateProps } from "./types";
import { TemplateAvatar, TemplateFooter, ProfileBadges, TemplateLinkPill } from "./shared";
import { ShareActions } from "@/components/public/share-actions";

/**
 * Página 1 — Clássico premium neutro.
 * Fundo escuro #121214, avatar centrado com brilho suave, nome e bio
 * centrados, botões em pílula discretos (cinza escuro) com ícone circular.
 */
export function TemplateOne({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = "#121214";
  const text = "#fafafa";
  const muted = "rgba(250,250,250,0.55)";
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
              className="ring-2 ring-white/15 shadow-[0_0_40px_-8px_rgba(255,255,255,0.25)]"
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

        {/* Links em pílulas */}
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
              iconColor="#e4e4e7"
              iconBg="rgba(255,255,255,0.07)"
              className="bg-[#1c1c1f] ring-1 ring-white/[0.09] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] hover:bg-[#232327] hover:ring-white/[0.16]"
            />
          ))}
        </nav>

        <TemplateFooter textColor={muted} />
      </div>
    </div>
  );
}
