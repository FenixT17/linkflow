import { Briefcase, Mail, MapPin } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter, ProfileBadges } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

const ACCENT = "#60a5fa";

/**
 * Empresarial — logótipo, descrição, serviços e contacto. Estrutura
 * profissional de empresa: header corporativo + grelha de serviços +
 * secção de contacto com botões de ação.
 */
export function BusinessTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const contactLinks = links.filter((l) => {
    const p = getPlatform(l.icon);
    return p?.category === "contact" || p?.category === "messaging";
  });
  const services = links.filter((l) => !contactLinks.includes(l));

  return (
    <div
      className="relative min-h-dvh"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div className="mx-auto w-full max-w-lg px-5 py-10">
        {/* Header corporativo */}
        <header className="flex items-center gap-4 border-b pb-6" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl ring-1 ring-white/15">
            {appearance.showAvatar !== false && profile.avatar ? (
              <TemplateAvatar src={profile.avatar} name={profile.displayName} size={56} badges={profile.badges} className="rounded-xl" />
            ) : (
              <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "rgba(96,165,250,0.2)" }}>
                <Briefcase className="h-6 w-6" style={{ color: ACCENT }} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 truncate text-lg font-semibold tracking-tight">{profile.displayName}</h1>
            <ProfileBadges badges={profile.badges} className="mt-1 justify-start" />
            <p className="text-xs" style={{ color: muted }}>
              {profile.bio?.split("\n")[0] || `@${profile.username}`}
            </p>
          </div>
          <div className="shrink-0">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {/* Descrição */}
        {appearance.showBio !== false && profile.bio && (
          <p className="mt-5 text-sm leading-relaxed" style={{ color: muted }}>
            {profile.bio}
          </p>
        )}

        {/* Serviços */}
        {services.length > 0 && (
          <section className="mt-8">
            <SectionLabel accent={ACCENT}>Serviços</SectionLabel>
            <div className="mt-3 space-y-3">
              {services.map((link) => (
                <TrackedLink
                  key={link.id}
                  link={link}
                  pageId={profile.$id}
                  className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-white/25 hover:bg-white/[0.06]"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "rgba(96,165,250,0.12)" }}
                  >
                    {link.icon ? (
                      <PlatformIcon
                        platformId={link.icon}
                        size={18}
                        color={getPlatform(link.icon)?.color ?? ACCENT}
                      />
                    ) : (
                      <Briefcase className="h-4 w-4" style={{ color: ACCENT }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{link.title || "Serviço"}</p>
                    {link.description && (
                      <p className="mt-0.5 truncate text-xs" style={{ color: muted }}>
                        {link.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: ACCENT }}>
                    Saber mais
                  </span>
                </TrackedLink>
              ))}
            </div>
          </section>
        )}

        {/* Contacto */}
        <section className="mt-8">
          <SectionLabel accent={ACCENT}>Contacto</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {contactLinks.length === 0 && (
              <p className="text-sm sm:col-span-2" style={{ color: muted }}>
                Sem contactos adicionados.
              </p>
            )}
            {contactLinks.map((link) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all hover:scale-[1.02]"
                style={{ borderColor: "rgba(96,165,250,0.4)", color: ACCENT }}
              >
                {link.icon ? (
                  <PlatformIcon platformId={link.icon} size={16} color={ACCENT} />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {link.title || "Contactar"}
              </TrackedLink>
            ))}
          </div>
        </section>

        {/* Localização / rodapé de empresa */}
        <div
          className="mt-8 flex items-center justify-center gap-1.5 border-t pt-6 text-xs"
          style={{ color: muted, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <MapPin className="h-3.5 w-3.5" />
          <span>@ {profile.username}</span>
        </div>

        <TemplateFooter />
      </div>
    </div>
  );
}
