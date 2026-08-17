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
  params: Promise<{ nomeUtilizador: string }>;
}

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { nomeUtilizador } = await params;
  let page;

  try {
    page = await getPublicPageByUsername(nomeUtilizador);
  } catch {
    return {
      title: "Perfil não encontrado — LinkFlow",
      robots: { index: false, follow: false },
    };
  }

  const url = `${siteUrl}/u/${encodeURIComponent(page.nomeUtilizador)}`;

  return {
    title: `${page.nomeExibicao} (@${page.nomeUtilizador}) — LinkFlow`,
    description: page.biografia || `Veja o perfil público de ${page.nomeExibicao} no LinkFlow.`,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      url,
      siteName: "LinkFlow",
      title: `${page.nomeExibicao} (@${page.nomeUtilizador}) — LinkFlow`,
      description: page.biografia || `Veja o perfil público de ${page.nomeExibicao} no LinkFlow.`,
    },
    twitter: {
      card: "summary",
      title: `${page.nomeExibicao} (@${page.nomeUtilizador}) — LinkFlow`,
      description: page.biografia || `Veja o perfil público de ${page.nomeExibicao} no LinkFlow.`,
    },
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { nomeUtilizador } = await params;

  let page;
  let links;
  let appearance;

  try {
    page = await getPublicPageByUsername(nomeUtilizador);
    [links, appearance] = await Promise.all([
      getPublicLinksByPageId(page.$id),
      getPublicThemeByPageId(page.$id),
    ]);
  } catch {
    notFound();
  }

  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const visibleLinks = links.filter((link: LinkItem) => link.visivel && link.ativo);
  const publicUrl = `${siteUrl}/u/${page.nomeUtilizador}`;
  const modeloPagina = isPageTemplate(page.modeloPagina) ? page.modeloPagina : DEFAULT_PAGE_TEMPLATE;

  const profileJsonLd = profilePageJsonLd(
    page.nomeUtilizador,
    page.nomeExibicao,
    page.biografia,
    publicUrl,
    page.avatar
  );
  const pageWebPageJsonLd = webPageJsonLd(
    `${page.nomeExibicao} (@${page.nomeUtilizador}) — LinkFlow`,
    page.biografia || `Veja o perfil público de ${page.nomeExibicao} no LinkFlow.`,
    publicUrl
  );
  const breadcrumbJsonLd = breadcrumbListJsonLd([
    { name: "Início", item: siteUrl },
    { name: page.nomeExibicao, item: publicUrl },
  ]);

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--background)]">
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={renderJsonLd([pageWebPageJsonLd, profileJsonLd, breadcrumbJsonLd])} />
      <ViewTracker idPagina={page.$id} />
      <PrivacyConsent />
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>
      <PageTemplate
        modeloPagina={modeloPagina}
        profile={page}
        links={visibleLinks}
        appearance={appearance}
        publicUrl={publicUrl}
      />
    </main>
  );
}
