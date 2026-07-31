import type { Metadata } from "next";

export const siteUrl = "https://linkflow.app";
export const siteName = "LinkFlow";
export const siteTagline = "Um Link. Possibilidades Infinitas.";
export const defaultDescription =
  "Crie uma página pessoal premium para partilhar todos os os seus links, redes sociais, vídeos, lojas e conteúdo num só lugar. Gratuito para sempre.";

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
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1200",
    },
  };
}

export function profilePageJsonLd(
  username: string,
  displayName: string,
  bio: string,
  url: string,
  image?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: displayName,
      description: bio,
      url,
      image: image || undefined,
      identifier: {
        "@type": "PropertyValue",
        name: "username",
        value: username,
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

export function renderJsonLd(data: object) {
  return {
    __html: JSON.stringify(data),
  };
}
