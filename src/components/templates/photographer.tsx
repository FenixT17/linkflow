import Image from "next/image";
import { Camera } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateFooter, ProfileBadges } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { sanitizeUrl } from "@/lib/sanitize";

const ACCENT = "#fbbf24";

/**
 * Fotógrafo — galeria em destaque e mosaico de fotografias.
 * Estrutura: hero de imagem a ecrã inteiro com nome sobreposto +
 * mosaico de fotografias. Texto reduzido ao mínimo.
 */
export function PhotographerTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";

  const featured = links.find((l) => l.image) ?? links[0];
  const gallery = links.filter((l) => l.id !== featured?.id);

  return (
    <div
      className="relative min-h-dvh"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      {/* Hero de imagem em destaque */}
      {featured?.image ? (
        <div className="relative h-[52vh] w-full overflow-hidden">
          <Image
            src={sanitizeUrl(featured.image)}
            alt={featured.title || "Destaque"}
            fill
            unoptimized
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
          <div className="absolute inset-x-0 bottom-0 p-6">
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white drop-shadow-lg">
              {profile.displayName}
            </h1>
            <ProfileBadges badges={profile.badges} className="mt-1.5" />
            <p className="mt-1 text-sm text-white/80">@{profile.username}</p>
            <div className="mt-3 flex items-center gap-3">
              <ShareActions publicUrl={publicUrl} />
            </div>
          </div>
        </div>
      ) : (
        <header className="flex flex-col items-center px-6 pb-8 pt-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(251,191,36,0.15)" }}>
            <Camera className="h-9 w-9" style={{ color: ACCENT }} />
          </div>
          <h1 className="mt-4 flex items-center gap-2 text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          <ProfileBadges badges={profile.badges} className="mt-1.5" />
          <p className="mt-1 text-sm opacity-60">@{profile.username}</p>
          <div className="mt-4">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>
      )}

      {/* Bio minimal */}
      {appearance.showBio !== false && profile.bio && (
        <p className="mx-auto max-w-md px-6 pt-6 text-center text-sm leading-relaxed opacity-75">
          {profile.bio}
        </p>
      )}

      {/* Mosaico de fotografias */}
      <section className="px-3 py-6" aria-label="Galerias">
        {links.length === 0 && (
          <p className="py-10 text-center text-sm opacity-50">Ainda não há fotografias.</p>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {gallery.map((link, i) => (
            <TrackedLink
              key={link.id}
              link={link}
              pageId={profile.$id}
              className={`group relative overflow-hidden rounded-lg ${i % 5 === 0 ? "col-span-2 row-span-2" : ""}`}
              aria-label={link.title || "Fotografia"}
            >
              {link.image ? (
                <div className="relative aspect-square w-full">
                  <Image
                    src={sanitizeUrl(link.image)}
                    alt={link.title || "Fotografia"}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>
              ) : (
                <div
                  className="flex aspect-square w-full items-center justify-center"
                  style={{ background: `linear-gradient(135deg, rgba(251,191,36,0.18), rgba(249,115,22,0.08))` }}
                >
                  <Camera className="h-6 w-6 opacity-70" style={{ color: ACCENT }} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30" />
            </TrackedLink>
          ))}
        </div>
      </section>

      <TemplateFooter />
    </div>
  );
}
