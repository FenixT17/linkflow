import Image from "next/image";
import { ShoppingBag, Tag } from "lucide-react";
import { TemplateProps } from "./types";
import { TrackedLink } from "./tracked-link";
import { TemplateAvatar, TemplateFooter, ProfileBadges } from "./shared";
import { ShareActions } from "@/components/public/share-actions";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatform } from "@/lib/platforms";
import { sanitizeUrl } from "@/lib/sanitize";

const ACCENT = "#34d399";

/**
 * Loja Online — produtos em cartões com imagem, promoções e botão Comprar.
 * Estrutura: faixa de promoção + grelha de produtos + secção de pagamentos.
 */
export function StoreTemplate({ profile, links, appearance, publicUrl }: TemplateProps) {
  const bg = appearance.backgroundColor || "#0a0a0a";
  const text = appearance.textColor || "#fafafa";
  const font = appearance.fontFamily || "Inter";
  const muted = "rgba(255,255,255,0.55)";

  const products = links.filter((l) => l.image || !l.icon || getPlatform(l.icon)?.category !== "payments");
  const paymentLinks = links.filter((l) => getPlatform(l.icon)?.category === "payments");

  return (
    <div
      className="relative min-h-dvh"
      style={{ backgroundColor: bg, color: text, fontFamily: font }}
    >
      {/* Faixa de promoção */}
      <div
        className="flex items-center justify-center gap-2 py-2.5 text-xs font-semibold uppercase tracking-wider"
        style={{ background: `linear-gradient(90deg, ${ACCENT}, #10b981)`, color: "#04120c" }}
      >
        <Tag className="h-3.5 w-3.5" /> Promoções exclusivas
      </div>

      <div className="mx-auto w-full max-w-md px-5 py-8">
        {/* Header da loja */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-white/15">
              {appearance.showAvatar !== false ? (
                <TemplateAvatar src={profile.avatar} name={profile.displayName} size={44} badges={profile.badges} />
              ) : (
                <ShoppingBag className="h-5 w-5" style={{ color: ACCENT }} />
              )}
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-base font-bold tracking-tight">{profile.displayName}</h1>
              <ProfileBadges badges={profile.badges} className="mt-1 justify-start" />
              <p className="text-xs" style={{ color: muted }}>
                @{profile.username}
              </p>
            </div>
          </div>
          <ShareActions publicUrl={publicUrl} />
        </header>

        {appearance.showBio !== false && profile.bio && (
          <p className="mt-4 text-sm leading-relaxed" style={{ color: muted }}>
            {profile.bio}
          </p>
        )}

        {/* Grelha de produtos */}
        <section className="mt-6" aria-label="Produtos">
          {products.length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: muted }}>
              Ainda não há produtos.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {products.map((link) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all hover:border-white/25 hover:shadow-xl"
              >
                <div className="relative aspect-square w-full overflow-hidden">
                  {link.image ? (
                    <Image
                      src={sanitizeUrl(link.image)}
                      alt={link.title || "Produto"}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: "rgba(52,211,153,0.1)" }}
                    >
                      {link.icon ? (
                        <PlatformIcon platformId={link.icon} size={32} color={ACCENT} />
                      ) : (
                        <ShoppingBag className="h-8 w-8" style={{ color: ACCENT }} />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="truncate text-sm font-semibold">{link.title || "Produto"}</p>
                  {link.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: muted }}>
                      {link.description}
                    </p>
                  )}
                  <span
                    className="mt-3 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold"
                    style={{ backgroundColor: ACCENT, color: "#04120c" }}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" /> Comprar
                  </span>
                </div>
              </TrackedLink>
            ))}
          </div>
        </section>

        {/* Pagamentos */}
        {paymentLinks.length > 0 && (
          <section className="mt-6 flex items-center justify-center gap-3">
            {paymentLinks.map((link) => (
              <TrackedLink
                key={link.id}
                link={link}
                pageId={profile.$id}
                aria-label={link.title || "Pagamento"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-all hover:scale-105"
              >
                <PlatformIcon
                  platformId={link.icon || "website"}
                  size={20}
                  color={getPlatform(link.icon)?.color ?? ACCENT}
                />
              </TrackedLink>
            ))}
          </section>
        )}

        <TemplateFooter />
      </div>
    </div>
  );
}
