import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getLiquidGlassClasses } from "@/lib/themes";
import {
  getPublicPageByUsername,
  getPublicLinksByPageId,
  getPublicThemeByPageId,
} from "@/lib/services.server";
import { ViewTracker } from "@/components/public/view-tracker";
import { TrackableLink } from "@/components/public/trackable-link";
import { ShareActions } from "@/components/public/share-actions";
import { LinkItem } from "@/lib/types";
import { sanitizeUrl } from "@/lib/sanitize";
import { siteUrl, profilePageJsonLd, renderJsonLd, webPageJsonLd, breadcrumbListJsonLd } from "@/lib/seo";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  let page;

  try {
    page = await getPublicPageByUsername(username);
  } catch {
    return {
      title: "Perfil não encontrado — LinkFlow",
      robots: { index: false, follow: false },
    };
  }

  const url = `${siteUrl}/u/${encodeURIComponent(page.username)}`;

  return {
    title: `${page.displayName} (@${page.username}) — LinkFlow`,
    description: page.bio || `Veja o perfil público de ${page.displayName} no LinkFlow.`,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      siteName: "LinkFlow",
      title: `${page.displayName} (@${page.username}) — LinkFlow`,
      description: page.bio || `Veja o perfil público de ${page.displayName} no LinkFlow.`,
    },
    twitter: {
      card: "summary",
      title: `${page.displayName} (@${page.username}) — LinkFlow`,
      description: page.bio || `Veja o perfil público de ${page.displayName} no LinkFlow.`,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;

  let page;
  let links;
  let appearance;

  try {
    page = await getPublicPageByUsername(username);
    [links, appearance] = await Promise.all([
      getPublicLinksByPageId(page.$id),
      getPublicThemeByPageId(page.$id),
    ]);
  } catch {
    notFound();
  }

  const theme = getLiquidGlassClasses();
  const visibleLinks = links.filter((link: LinkItem) => link.visible && link.active);
  const publicUrl = `${siteUrl}/u/${page.username}`;

  const profileJsonLd = profilePageJsonLd(
    page.username,
    page.displayName,
    page.bio,
    publicUrl,
    page.avatar
  );
  const pageWebPageJsonLd = webPageJsonLd(
    `${page.displayName} (@${page.username}) — LinkFlow`,
    page.bio || `Veja o perfil público de ${page.displayName} no LinkFlow.`,
    publicUrl
  );
  const breadcrumbJsonLd = breadcrumbListJsonLd([
    { name: "Início", item: siteUrl },
    { name: page.displayName, item: publicUrl },
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={renderJsonLd([pageWebPageJsonLd, profileJsonLd, breadcrumbJsonLd])} />
      <ViewTracker pageId={page.$id} />
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-4 sm:px-6 py-10 sm:py-20">
        <div
          className={`w-full overflow-hidden ${theme.cardClass}`}
          style={{
            borderRadius: appearance.rounded,
            backdropFilter: `blur(${appearance.blur}px)`,
          }}
        >
          {/* Cover/Banner */}
          <div className="relative z-[1]">
            {page.banner ? (
              <div
                className="h-32 rounded-t-[inherit]"
                style={{
                  backgroundImage: `url(${sanitizeUrl(page.banner)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            ) : (
              <div className="h-32 rounded-t-[inherit] glass-strong" />
            )}
          </div>

          <div className="relative z-[1] flex flex-col items-center px-6 pb-8 -mt-12">
            {appearance.showAvatar && (
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full glass border-2 border-white/[var(--glass-border-opacity)] ring-1 ring-white/[0.06] ring-offset-2 ring-offset-[var(--background)]">
                {page.avatar ? (
                  <Image
                    src={sanitizeUrl(page.avatar)}
                    alt={`Foto de perfil de ${page.displayName}`}
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                    priority
                  />
                ) : (
                  <span className="text-2xl font-semibold text-[var(--foreground)]/70">
                    {page.displayName?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
            )}
            <h1 className={`mt-4 text-2xl font-semibold tracking-tight text-center relative z-[1] ${theme.titleClass}`}>
              {page.displayName}
            </h1>
            <p className={`text-sm relative z-[1] ${theme.usernameClass}`}>@{page.username}</p>
            {appearance.showBio && (
              <p className={`mt-3 text-center text-sm leading-relaxed relative z-[1] ${theme.bioClass}`}>
                {page.bio}
              </p>
            )}
            <ShareActions publicUrl={publicUrl} />
          </div>
        </div>

        <div className="mt-6 w-full space-y-3" style={{ gap: appearance.spacing * 4 }}>
          {visibleLinks.length === 0 && (
            <div
              className={`p-6 text-center ${theme.cardClass}`}
              style={{ borderRadius: appearance.rounded, backdropFilter: `blur(${appearance.blur}px)` }}
            >
              <p className={`text-sm relative z-[1] ${theme.bioClass}`}>Ainda não há links.</p>
            </div>
          )}
          {visibleLinks.map((link: LinkItem) => (
            <TrackableLink
              key={link.id}
              link={link}
              pageId={page.$id}
              appearance={appearance}
            />
          ))}
        </div>

        <footer className="mt-12 text-center">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 text-xs font-medium ${theme.footerClass} transition-colors`}
          >
            LinkFlow
          </Link>
        </footer>
      </div>
    </main>
  );
}
