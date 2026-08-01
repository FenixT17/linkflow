import { Ticket, MapPin, Clock, Sparkles } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter } from "./shared";
import { Countdown } from "./countdown";
import { ShareActions } from "@/components/public/share-actions";

const ACCENT = "#f472b6";

/**
 * Evento — contagem decrescente, data, bilhetes e programação.
 * Estrutura: header do evento + countdown + CTA de bilhetes +
 * lista de programação.
 */
export function EventTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const ticket = links.find((l) => /bilhete|ticket|ingresso|entrada/i.test(l.title || "")) ?? links[0];
  const program = links.filter((l) => l.id !== ticket?.id);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-[110px]"
        style={{ backgroundColor: "rgba(244,114,182,0.25)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-md px-5 py-12">
        {/* Header do evento */}
        <header className="flex flex-col items-center text-center">
          {appearance.showAvatar !== false && (
            <TemplateAvatar
              src={profile.avatar}
              name={profile.displayName}
              size={80}
              className="ring-2 ring-pink-400/40"
            />
          )}
          <span
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
            style={{ backgroundColor: "rgba(244,114,182,0.14)", color: ACCENT }}
          >
            <Sparkles className="h-3 w-3" /> Evento
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-2 max-w-sm text-sm leading-relaxed opacity-80">{profile.bio}</p>
          )}
          <div className="mt-4">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {/* Contagem decrescente */}
        <section className="mt-8 flex flex-col items-center">
          <SectionLabel accent={ACCENT} className="mb-3">
            Contagem decrescente
          </SectionLabel>
          <Countdown accent={ACCENT} />
        </section>

        {/* Data e local */}
        <div className="mt-6 flex items-center justify-center gap-3 text-xs" style={{ color: muted }}>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Data a anunciar
          </span>
          <span className="opacity-40">•</span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> @{profile.username}
          </span>
        </div>

        {/* Bilhetes */}
        {ticket && (
          <TrackedLink
            link={ticket}
            pageId={profile.$id}
            className="mt-8 flex items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-bold transition-all hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #ec4899)`,
              boxShadow: "0 10px 40px rgba(244,114,182,0.3)",
              color: "#fff",
            }}
          >
            <Ticket className="h-5 w-5" /> {ticket.title || "Comprar bilhetes"}
          </TrackedLink>
        )}

        {/* Programação */}
        <section className="mt-9">
          <SectionLabel accent={ACCENT}>Programação</SectionLabel>
          {program.length === 0 && (
            <p className="mt-3 text-sm" style={{ color: muted }}>
              A programação será anunciada em breve.
            </p>
          )}
          <div className="mt-3 space-y-2.5">
            {program.map((link, i) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition-all hover:border-white/25"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ backgroundColor: "rgba(244,114,182,0.14)", color: ACCENT }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{link.title || `Sessão ${i + 1}`}</p>
                  {link.description && (
                    <p className="truncate text-xs" style={{ color: muted }}>
                      {link.description}
                    </p>
                  )}
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
