import Image from "next/image";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { sanitizeUrl } from "@/lib/sanitize";

const ACCENT = "#818cf8";

/**
 * Portfólio — grelha de projetos com imagens, categorias e botão Ver Projeto.
 * Estrutura: header centrado + chips de categoria + grelha de projetos.
 */
export function PortfolioTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const categories = Array.from(
    new Set(links.map((l) => getPlatform(l.icon)?.category).filter(Boolean))
  ).slice(0, 6);

  return (
    <div
      className="relative min-h-dvh"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div className="mx-auto w-full max-w-lg px-5 py-12">
        {/* Header do portfólio */}
        <header className="flex flex-col items-center text-center">
          {appearance.showAvatar !== false && (
            <TemplateAvatar
              src={profile.avatar}
              name={profile.displayName}
              size={80}
              className="ring-1 ring-white/10"
            />
          )}
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: muted }}>
              {profile.bio}
            </p>
          )}
          <div className="mt-4">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {/* Chips de categorias */}
        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {categories.map((c) => (
              <span
                key={c}
                className="rounded-full border px-3 py-1 text-[11px] font-medium capitalize"
                style={{ borderColor: "rgba(129,140,248,0.35)", color: ACCENT }}
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Grelha de projetos */}
        <section className="mt-8">
          <SectionLabel accent={ACCENT}>Projetos</SectionLabel>
          {links.length === 0 && (
            <p className="mt-3 py-8 text-center text-sm" style={{ color: muted }}>
              Ainda não há projetos.
            </p>
          )}
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {links.map((link) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:-translate-y-1 hover:border-white/25"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {link.image ? (
                    <Image
                      src={sanitizeUrl(link.image)}
                      alt={link.title || "Projeto"}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: "rgba(129,140,248,0.12)" }}
                    >
                      {link.icon ? (
                        <PlatformIcon platformId={link.icon} size={36} color={ACCENT} />
                      ) : (
                        <FolderOpen className="h-10 w-10" style={{ color: ACCENT }} />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-semibold">{link.title || "Projeto"}</p>
                  {link.description && (
                    <p className="mt-1 line-clamp-2 text-xs" style={{ color: muted }}>
                      {link.description}
                    </p>
                  )}
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ACCENT }}>
                    Ver Projeto <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </TrackedLink>
            ))}
          </div>
        </section>

        <TemplateFooter />
      </div>
    </div>
  );
}
