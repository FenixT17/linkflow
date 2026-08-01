import { ArrowUpRight } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, TemplateFooter } from "./shared";
import { ShareActions } from "@/components/public/share-actions";

/**
 * Minimalista — avatar pequeno, links simples, muito espaço branco.
 * Estrutura: cabeçalho centrado e condensado + lista de links em linhas
 * separadas por divisórias finas. Nada de cartões nem gradientes.
 */
export function MinimalTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const muted = "rgba(255,255,255,0.45)";
  const divider = "rgba(255,255,255,0.08)";
  const font = appearance.fontFamily || "Inter";

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-16">
        {/* Header minimal */}
        <header className="flex flex-col items-center text-center">
          {appearance.showAvatar !== false && (
            <TemplateAvatar
              src={profile.avatar}
              name={profile.displayName}
              size={64}
              className="ring-1 ring-white/10"
            />
          )}
          <h1 className="mt-5 text-lg font-medium tracking-tight">{profile.displayName}</h1>
          <p className="mt-0.5 text-xs" style={{ color: muted }}>
            @{profile.username}
          </p>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: muted }}>
              {profile.bio}
            </p>
          )}
          <div className="mt-4">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {/* Links em linhas simples */}
        <nav className="mt-10 flex flex-col" aria-label="Links">
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
              className="group flex items-center justify-between border-b py-4 text-sm transition-opacity hover:opacity-70"
              style={{ borderColor: divider }}
            >
              <span className="font-medium">{link.title || "Link"}</span>
              <ArrowUpRight
                className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60"
                aria-hidden="true"
              />
            </TrackedLink>
          ))}
        </nav>

        <TemplateFooter textColor={muted} />
      </div>
    </div>
  );
}
