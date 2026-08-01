import { CalendarCheck, MapPin, Bike } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, SectionLabel, TemplateFooter } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";

const ACCENT = "#fb923c";

/**
 * Restaurante — menu, reservas, localização e delivery.
 * Estrutura: header acolhedor + lista de pratos com líderes pontilhados +
 * botões de ação (reservas / localização / delivery).
 */
export function RestaurantTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const isMapLink = (icon?: string) => getPlatform(icon)?.category === "contact" && ["googlemaps", "applemaps", "waze"].includes(icon || "");
  const mapLinks = links.filter((l) => isMapLink(l.icon));
  const menuItems = links.filter((l) => !isMapLink(l.icon));

  const actions = [
    ...menuItems.slice(0, 1).map((l) => ({ icon: CalendarCheck, label: "Reservas", link: l })),
    ...mapLinks.slice(0, 1).map((l) => ({ icon: MapPin, label: "Localização", link: l })),
    ...menuItems.slice(1, 2).map((l) => ({ icon: Bike, label: "Delivery", link: l })),
  ].filter((a) => a.link);

  return (
    <div
      className="relative min-h-dvh"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      <div className="mx-auto w-full max-w-md px-5 py-10">
        {/* Header do restaurante */}
        <header className="flex flex-col items-center border-b pb-6 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {appearance.showAvatar !== false && (
            <TemplateAvatar
              src={profile.avatar}
              name={profile.displayName}
              size={88}
              className="ring-2 ring-orange-400/40"
            />
          )}
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{profile.displayName}</h1>
          <p className="mt-1 text-xs" style={{ color: muted }}>
            @{profile.username}
          </p>
          {appearance.showBio !== false && profile.bio && (
            <p className="mt-3 max-w-sm text-sm leading-relaxed" style={{ color: muted }}>
              {profile.bio}
            </p>
          )}
          <div className="mt-4">
            <ShareActions publicUrl={publicUrl} />
          </div>
        </header>

        {/* Botões de ação */}
        {actions.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {actions.map((a) => (
              <TrackedLink
                key={a.label}
                link={a.link}
                pageId={profile.$id}
                className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-semibold transition-all hover:scale-[1.03]"
                style={{ borderColor: "rgba(251,146,60,0.35)", color: ACCENT }}
              >
                <a.icon className="h-4 w-4" />
                {a.label}
              </TrackedLink>
            ))}
          </div>
        )}

        {/* Menu */}
        <section className="mt-8">
          <SectionLabel accent={ACCENT}>Menu</SectionLabel>
          {menuItems.length === 0 && (
            <p className="mt-3 py-6 text-center text-sm" style={{ color: muted }}>
              Ainda não há itens no menu.
            </p>
          )}
          <div className="mt-3 space-y-4">
            {menuItems.map((link, i) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                className="group block"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{link.title || `Item ${i + 1}`}</span>
                  <span
                    className="flex-1 border-b border-dotted"
                    style={{ borderColor: "rgba(255,255,255,0.2)" }}
                    aria-hidden="true"
                  />
                  {link.icon && (
                    <PlatformIcon
                      platformId={link.icon}
                      size={14}
                      color={getPlatform(link.icon)?.color ?? ACCENT}
                      className="translate-y-0.5"
                    />
                  )}
                </div>
                {link.description && (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: muted }}>
                    {link.description}
                  </p>
                )}
              </TrackedLink>
            ))}
          </div>
        </section>

        <TemplateFooter />
      </div>
    </div>
  );
}
