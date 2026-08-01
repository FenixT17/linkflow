import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { detectDeviceType, detectBrowser, detectOS } from "@/lib/device-detect";

// NOTA: Este endpoint é público e anónimo — regista cliques de
// visitantes não autenticados na página pública /u/[username]. Aplica
// rate limiting por IP para evitar manipulação de métricas.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (typeof body.pageId !== "string" || !body.pageId.trim()) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }
    const pageId = body.pageId.trim();
    const linkId = typeof body.linkId === "string" ? body.linkId.trim() : "";

    // Rate limit: max 20 clicks per IP per minute to prevent metric spam
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit("click", ip, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { databases } = createServerClient();

    let pageDoc;
    try {
      pageDoc = await databases.getDocument(databaseId, "pages", pageId);
      if (!pageDoc.published) {
        return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const referer = request.headers.get("referer") ?? "";
    const geo = await resolveGeo(ip, request);

    // Detalhes do link clicado (para o agregado real de Top Links)
    let linkTitle = "";
    let linkUrl = "";
    if (linkId) {
      try {
        const linkDoc = await databases.getDocument(databaseId, "links", linkId);
        if (linkDoc) {
          linkTitle = String(linkDoc.title ?? "");
          linkUrl = String(linkDoc.url ?? "");
          await databases.updateDocument(databaseId, "links", linkId, {
            clicks: (Number(linkDoc.clicks) || 0) + 1,
          });
        }
      } catch {
        // Link not found; ignore
      }
    }

    // Regista o clique com todos os dados reais recolhidos.
    await recordAnalyticsEvent(databases, {
      pageId,
      ownerUserId: String(pageDoc.userId),
      type: "clicks",
      userAgent,
      ip,
      referer,
      geo,
      device: detectDeviceType(userAgent),
      browser: detectBrowser(userAgent),
      os: detectOS(userAgent),
      linkId,
      linkTitle,
      linkUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/click] error:", error);
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Failed to record click";
    return NextResponse.json({ error: message }, { status });
  }
}
