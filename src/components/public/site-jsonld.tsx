"use client";

import { useNonce } from "@/components/ui/nonce-provider";
import { faqPageJsonLd, webPageJsonLd, siteUrl, renderJsonLd } from "@/lib/seo";
import { faqs } from "@/data/faqs";

const faqJsonLd = faqPageJsonLd(faqs);

const pageJsonLd = webPageJsonLd(
  "LinkFlow — Um Link. Possibilidades Infinitas.",
  "Crie uma página pessoal premium para partilhar todos os seus links, redes sociais, vídeos, lojas e conteúdo num só lugar.",
  siteUrl
);

const jsonLdData = [pageJsonLd, faqJsonLd];

export function SiteJsonLd() {
  const nonce = useNonce();

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={renderJsonLd(jsonLdData)}
    />
  );
}
