import type { Metadata } from "next";
import { normalizeEnvUrl } from "@/lib/utils";

// Domínio canónico: NEXT_PUBLIC_SITE_URL (definido no build — ver
// .github/workflows/deploy.yml). Fallback para o domínio Cloudflare
// (workers.dev) — substituir pelo subdomínio real da conta em produção.
//
// `normalizeEnvUrl` valida a variável (trim + URL http(s) válida) e devolve
// o fallback quando ela está ausente, vazia ou inválida. Isto é crítico no
// CI: o GitHub Actions injeta secrets não configurados como STRING VAZIA, e
// `??` não a captura — `new URL("")` (metadataBase) quebrava o build com
// "TypeError: Invalid URL. Input: ''" ao coletar /_not-found.
export const siteUrl = normalizeEnvUrl(
  process.env.NEXT_PUBLIC_SITE_URL,
  "https://linkflow.workers.dev"
);
export const siteName = "LinkFlow";
export const siteTagline = "Um Link. Possibilidades Infinitas.";
export const defaultDescription =
  "Crie uma página pessoal premium para partilhar todos os seus links, redes sociais, vídeos, lojas e conteúdo num só lugar.";

export interface SiteMetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

export function buildMetadata(options: SiteMetadataOptions = {}): Metadata {
  const {
    title = `${siteName} — ${siteTagline}`,
    description = defaultDescription,
    path = "/",
    image = `${siteUrl}/og-image.png`,
    noIndex = false,
  } = options;

  const url = `${siteUrl}${path}`;

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName,
      title,
      description,
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: url,
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/u/{search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteName,
    url: siteUrl,
    description: defaultDescription,
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        name: "Gratuito",
      },
      {
        "@type": "Offer",
        price: "7.99",
        priceCurrency: "EUR",
        name: "Pro",
      },
      {
        "@type": "Offer",
        price: "19.99",
        priceCurrency: "EUR",
        name: "Business",
      },
    ],
  };
}

export function profilePageJsonLd(
  nomeUtilizador: string,
  nomeExibicao: string,
  bio: string,
  url: string,
  image?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: nomeExibicao,
      description: bio,
      url,
      image: image || undefined,
      identifier: {
        "@type": "PropertyValue",
        name: "nomeUtilizador",
        value: nomeUtilizador,
      },
    },
  };
}

export function faqPageJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function breadcrumbListJsonLd(items: { name: string; item: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };
}

export function webPageJsonLd(title: string, description: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url,
  };
}

/**
 * Serializa dados JSON-LD de forma segura para injeção num <script>.
 *
 * `JSON.stringify` NÃO escapa `<`, `>`, `&` nem U+2028/U+2029. Se um campo
 * controlado pelo utilizador (ex.: bio, nomeExibicao) contiver `</script>…`,
 * o valor quebraria o <script type="application/ld+json"> e permitiria
 * stored XSS (CWE-79). Este escape impede o breakout do script tag.
 */
export function renderJsonLd(data: object) {
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return {
    __html: json,
  };
}
