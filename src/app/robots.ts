import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/**
 * robots.txt gerado dinamicamente a partir de `siteUrl` (fonte única do
 * domínio canónico — ver src/lib/seo.ts). Substitui o public/robots.txt
 * estático, que apontava para o domínio Netlify.
 *
 * ATENÇÃO: este ficheiro NÃO é um mecanismo de segurança — as rotas privadas
 * são protegidas pelo servidor. As diretivas servem apenas para crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  const blockAiCrawlers = ["/dashboard/", "/api/", "/auth/"];
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/demo", "/u/"],
        disallow: ["/dashboard", "/api", "/auth", "/login", "/register"],
      },
      { userAgent: "ChatGPT", disallow: blockAiCrawlers },
      { userAgent: "GPTBot", disallow: blockAiCrawlers },
      { userAgent: "ClaudeBot", disallow: blockAiCrawlers },
      { userAgent: "Google-Extended", disallow: blockAiCrawlers },
      { userAgent: "Bytespider", disallow: blockAiCrawlers },
      { userAgent: "CCBot", disallow: blockAiCrawlers },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
