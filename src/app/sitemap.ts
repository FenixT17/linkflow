import type { MetadataRoute } from "next";
import { getPublicPublishedUsernames } from "@/lib/services.server";

const siteUrl = "https://linkflow.app";

/**
 * Gera o sitemap XML do LinkFlow com todas as páginas públicas.
 * Rotas privadas (dashboard, auth, API, admin, etc.) são EXCLUÍDAS de propósito.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/demo`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  let profilePages: MetadataRoute.Sitemap = [];
  try {
    const usernames = await getPublicPublishedUsernames(1000);
    profilePages = usernames.map((username) => ({
      url: `${siteUrl}/u/${encodeURIComponent(username)}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch {
    // Se o Appwrite não estiver configurado (ex: build de CI), retornamos
    // apenas as páginas estáticas para não quebrar o sitemap.
    profilePages = [];
  }

  return [...staticPages, ...profilePages];
}
