import { NextResponse } from "next/server";
import { gzipSync } from "node:zlib";
import sitemap from "../../sitemap";

export const dynamic = "force-static";
export const revalidate = 3600;

function buildSitemapXml(entries: { url: string; lastModified?: Date | string; changeFrequency?: string; priority?: number }[]) {
  const urlset = entries
    .map((entry) => {
      const lastmod = entry.lastModified ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>` : "";
      const changefreq = entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : "";
      const priority = typeof entry.priority === "number" ? `<priority>${entry.priority}</priority>` : "";
      return `  <url>\n    <loc>${entry.url}</loc>\n    ${lastmod}\n    ${changefreq}\n    ${priority}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlset}\n</urlset>`;
}

export async function GET() {
  let entries;
  try {
    entries = await sitemap();
  } catch {
    return NextResponse.json({ error: "Failed to generate sitemap" }, { status: 500 });
  }

  const xml = buildSitemapXml(entries);
  const gz = gzipSync(Buffer.from(xml, "utf-8"));

  return new NextResponse(gz, {
    headers: {
      "Content-Type": "application/x-gzip",
      "Content-Encoding": "gzip",
      "Content-Length": gz.length.toString(),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
