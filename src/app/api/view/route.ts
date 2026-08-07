import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { detectDeviceType, detectBrowser, detectOS } from "@/lib/device-detect";

// NOTA: Este endpoint é público e anónimo — regista visualizações de
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

    // Rate limit: max 10 views per IP per minute to prevent metric spam
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit("view", ip, { maxRequests: 10, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) });
    }

    const { databases } = createServerClient();

    let pageDoc;
    try {
      pageDoc = await databases.getDocument(databaseId, "pages", pageId);
      if (!pageDoc.published || pageDoc.deleting === true) {
        return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
      }
    } catch {
      // M5: resposta IDÊNTICA em ambos os casos (doc inexistente vs permissão
      // negada) — sem timing/body diferente que permita enumerar páginas.
      return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const referer = request.headers.get("referer") ?? "";
    // Nome do dispositivo via User-Agent Client Hints (ex: "Pixel 7",
    // "iPhone 15 Pro") — o header só existe quando o browser o envia.
    const deviceName = request.headers.get("sec-ch-ua-model") ?? "";

    // GeoIP real (país/cidade) a partir do IP — nunca exposto ao cliente.
    const geo = await resolveGeo(ip, request);

    // Regista a visualização com todos os dados reais recolhidos.
    await recordAnalyticsEvent(databases, {
      pageId,
      ownerUserId: String(pageDoc.userId),
      type: "views",
      userAgent,
      ip,
      referer,
      geo,
      device: detectDeviceType(userAgent),
      browser: detectBrowser(userAgent),
      os: detectOS(userAgent),
      deviceName,
    });

    return NextResponse.json({ success: true }, { headers: mergeRateLimitHeaders(undefined, rateLimit) });
  } catch (error) {
    console.error("[api/view] error:", error);
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Failed to record view";
    return NextResponse.json({ error: message }, { status });
  }
}
