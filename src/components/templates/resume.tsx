import { GraduationCap, Award, Download } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

const ACCENT = "#2dd4bf";

/**
 * Currículo / CV — documento profissional com experiência, competências,
 * educação e certificações. Estrutura de duas colunas (CV clássico).
 */
export function ResumeTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const skills = links.filter((l) => l.icon);
  const experience = links;

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div className="mx-auto w-full max-w-lg px-5 py-12">
        {/* Cabeçalho do CV */}
        <header className="border-b pb-6" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex items-center gap-4">
            {appearance.showAvatar !== false && (
              <TemplateAvatar
                src={profile.avatar}
                name={profile.displayName}
                size={72}
                className="ring-2 ring-teal-400/40"
              />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACCENT }}>
                Curriculum Vitae
              </p>
              <h1 className="mt-1 truncate text-2xl font-bold tracking-tight">{profile.displayName}</h1>
              <p className="mt-0.5 truncate text-sm" style={{ color: muted }}>
                @{profile.username}
              </p>
            </div>
            <div className="ml-auto shrink-0">
              <ShareActions publicUrl={publicUrl} />
            </div>
          </div>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-4 text-sm leading-relaxed" style={{ color: muted }}>
              {profile.bio}
            </p>
          )}
        </header>

        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-5">
          {/* Coluna principal — experiência */}
          <section className="sm:col-span-3">
            <SectionLabel accent={ACCENT}>Experiência</SectionLabel>
            {experience.length === 0 && (
              <p className="mt-3 text-sm" style={{ color: muted }}>
                Sem experiência listada.
              </p>
            )}
            <div className="relative mt-4 space-y-6 border-l pl-5" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              {experience.map((link, i) => (
                <TrackedLink key={link.id} link={link} pageId={profile.$id} className="group relative block">
                  <span
                    className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2"
                    style={{ backgroundColor: bg, borderColor: ACCENT }}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-semibold">{link.title || `Cargo ${i + 1}`}</p>
                  <p className="text-[11px] uppercase tracking-wider" style={{ color: ACCENT }}>
                    {getPlatform(link.icon)?.name || "LinkFlow"}
                  </p>
                  {link.description && (
                    <p className="mt-1.5 text-xs leading-relaxed" style={{ color: muted }}>
                      {link.description}
                    </p>
                  )}
                </TrackedLink>
              ))}
            </div>
          </section>

          {/* Coluna lateral — competências, educação, certificações */}
          <aside className="space-y-8 sm:col-span-2">
            <section>
              <SectionLabel accent={ACCENT}>Competências</SectionLabel>
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.length === 0 && (
                  <p className="text-xs" style={{ color: muted }}>Sem competências.</p>
                )}
                {skills.map((link) => (
                  <span
                    key={link.id}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                    style={{ borderColor: "rgba(45,212,191,0.3)", color: ACCENT }}
                  >
                    <PlatformIcon
                      platformId={link.icon || "website"}
                      size={12}
                      color={getPlatform(link.icon)?.color ?? ACCENT}
                    />
                    {link.title || "Skill"}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel accent={ACCENT}>Educação</SectionLabel>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <GraduationCap className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
                <div>
                  <p className="text-sm font-medium">{profile.displayName}</p>
                  <p className="text-xs" style={{ color: muted }}>Em constante aprendizagem</p>
                </div>
              </div>
            </section>

            <section>
              <SectionLabel accent={ACCENT}>Certificações</SectionLabel>
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <Award className="h-5 w-5 shrink-0" style={{ color: ACCENT }} />
                <div>
                  <p className="text-sm font-medium">Criador LinkFlow</p>
                  <p className="text-xs" style={{ color: muted }}>Página @{profile.username}</p>
                </div>
              </div>
            </section>
          </aside>
        </div>

        {/* Botão de download fictício (primeiro link) */}
        {experience.length > 0 && (
          <div className="mt-10">
            <TrackedLink
              link={experience[0]}
              pageId={profile.$id}
              className="flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-all hover:scale-[1.01]"
              style={{ borderColor: "rgba(45,212,191,0.4)", color: ACCENT }}
            >
              <Download className="h-4 w-4" /> Descarregar CV
            </TrackedLink>
          </div>
        )}

        <TemplateFooter />
      </div>
    </div>
  );
}
