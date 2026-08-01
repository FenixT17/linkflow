import { GitBranch, Star, Braces } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

const ACCENT = "#22d3ee";

/**
 * Desenvolvedor — GitHub, projetos, stack tecnológica e Open to Work.
 * Estrutura: header com badge Open to Work + cartões de repositórios
 * (estilo GitHub) + chips de stack + contacto.
 */
export function DeveloperTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const githubLinks = links.filter((l) => ["github", "gitlab", "bitbucket", "stackoverflow"].includes(l.icon || ""));
  const projects = links.filter((l) => !githubLinks.includes(l));

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div className="mx-auto w-full max-w-md px-5 py-10">
        {/* Barra de terminal */}
        <div
          className="flex items-center gap-2 rounded-t-xl border border-b-0 px-4 py-2.5"
          style={{ borderColor: "rgba(34,211,238,0.2)", backgroundColor: "rgba(255,255,255,0.03)" }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 font-mono text-[11px]" style={{ color: muted }}>
            ~/{profile.username}
          </span>
        </div>

        <div
          className="overflow-hidden rounded-b-xl border px-5 pb-8 pt-6"
          style={{ borderColor: "rgba(34,211,238,0.2)" }}
        >
          {/* Header do dev */}
          <header className="flex items-center gap-4">
            {appearance.showAvatar !== false && (
              <TemplateAvatar
                src={profile.avatar}
                name={profile.displayName}
                size={72}
                className="rounded-2xl ring-2 ring-cyan-400/40"
              />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight">{profile.displayName}</h1>
              <p className="truncate font-mono text-xs" style={{ color: muted }}>
                @{profile.username}
              </p>
              <span
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: "rgba(34,211,238,0.14)", color: ACCENT }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: ACCENT }} />
                Open to Work
              </span>
            </div>
            <div className="ml-auto shrink-0">
              <ShareActions publicUrl={publicUrl} />
            </div>
          </header>

          {appearance.showBio !== false && profile.bio && (
            <p className="mt-4 font-mono text-sm leading-relaxed" style={{ color: muted }}>
              {profile.bio}
            </p>
          )}

          {/* Repositórios / projetos */}
          <section className="mt-7">
            <SectionLabel accent={ACCENT}>Repositórios</SectionLabel>
            {projects.length === 0 && (
              <p className="mt-3 font-mono text-sm" style={{ color: muted }}>
                $ git clone --empty
              </p>
            )}
            <div className="mt-3 space-y-2.5">
              {projects.map((link, i) => (
                <TrackedLink
                  key={link.id}
                  link={link}
                  pageId={profile.$id}
                  className="group block rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-all hover:border-cyan-400/40"
                >
                  <div className="flex items-center gap-2 font-mono">
                    <GitBranch className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                    <span className="truncate text-sm font-semibold">{link.title || `repo-${i + 1}`}</span>
                    <span className="ml-auto flex items-center gap-1 text-[11px] opacity-50">
                      <Star className="h-3 w-3" /> {link.clicks || 0}
                    </span>
                  </div>
                  {link.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs" style={{ color: muted }}>
                      {link.description}
                    </p>
                  )}
                  <p className="mt-2.5 flex items-center gap-1.5 text-[11px]" style={{ color: muted }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ACCENT }} />
                    {getPlatform(link.icon)?.name || "JavaScript"}
                  </p>
                </TrackedLink>
              ))}
            </div>
          </section>

          {/* Stack tecnológica */}
          <section className="mt-7">
            <SectionLabel accent={ACCENT}>Stack</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-400/30 px-2 py-1 font-mono text-[11px]" style={{ color: ACCENT }}>
                <Braces className="h-3 w-3" /> {links.length > 0 ? "TypeScript" : "Hello, world!"}
              </span>
              {links.slice(0, 5).map((link) => (
                <span
                  key={link.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 font-mono text-[11px]"
                  style={{ color: muted }}
                >
                  {link.icon && (
                    <PlatformIcon
                      platformId={link.icon}
                      size={12}
                      color={getPlatform(link.icon)?.color ?? ACCENT}
                    />
                  )}
                  {link.title || "stack"}
                </span>
              ))}
            </div>
          </section>

          {/* Contacto */}
          {githubLinks.length > 0 && (
            <section className="mt-7 flex flex-wrap gap-2.5">
              {githubLinks.map((link) => (
                <TrackedLink
                  key={link.id}
                  link={link}
                  pageId={profile.$id}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:scale-[1.02]"
                  style={{ borderColor: "rgba(34,211,238,0.35)", color: ACCENT }}
                >
                  <PlatformIcon
                    platformId={link.icon || "github"}
                    size={16}
                    color={getPlatform(link.icon)?.color ?? ACCENT}
                  />
                  {link.title || "GitHub"}
                </TrackedLink>
              ))}
            </section>
          )}
        </div>

        <TemplateFooter />
      </div>
    </div>
  );
}
