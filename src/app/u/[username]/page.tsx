import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import {
  getPublicPageByUsername,
  getPublicLinksByPageId,
  getPublicThemeByPageId,
} from "@/lib/services.server";
import { ViewTracker } from "@/components/public/view-tracker";
import { PageTemplate } from "@/components/templates";
import { LinkItem } from "@/lib/types";
import { siteUrl, profilePageJsonLd, renderJsonLd, webPageJsonLd, breadcrumbListJsonLd } from "@/lib/seo";
import { isPageTemplate, DEFAULT_PAGE_TEMPLATE } from "@/lib/page-templates";
import { PrivacyConsent } from "@/components/public/privacy-consent";

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

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const visibleLinks = links.filter((link: LinkItem) => link.visible && link.active);
  const publicUrl = `${siteUrl}/u/${page.username}`;
  const pageTemplate = isPageTemplate(page.pageTemplate) ? page.pageTemplate : DEFAULT_PAGE_TEMPLATE;

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
    <main className="relative min-h-dvh overflow-hidden bg-[var(--background)]">
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={renderJsonLd([pageWebPageJsonLd, profileJsonLd, breadcrumbJsonLd])} />
      <ViewTracker pageId={page.$id} />
      <PrivacyConsent />
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>
      <PageTemplate
        pageTemplate={pageTemplate}
        profile={page}
        links={visibleLinks}
        appearance={appearance}
        publicUrl={publicUrl}
      />
    </main>
  );
}
