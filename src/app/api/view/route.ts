import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { recordAnalyticsEvent } from "@/lib/analytics";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { detectDeviceType, detectBrowser, detectOS } from "@/lib/device-detect";
import { isSameOriginMediaReferrer } from "@/lib/media-security";
import { isStudyConsentGranted } from "@/lib/privacy";
import { isPublicAt } from "@/lib/page-publication";

const MAX_BODY_BYTES = 16 * 1024;

// NOTA: Este endpoint é público e anónimo — regista visualizações de
// visitantes não autenticados na página pública /u/[nomeUtilizador]. Aplica
// rate limiting por IP para evitar manipulação de métricas.
export async function POST(request: NextRequest) {
  try {
    const referer = request.headers.get("referer");
    const origin = request.headers.get("origin");
    const sameOrigin =
      (!referer || isSameOriginMediaReferrer(request.url, referer)) &&
      (!origin || origin === new URL(request.url).origin);
    if (!sameOrigin) {
      return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) {
      return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = null;
    }
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (typeof body.idPagina !== "string" || !body.idPagina.trim()) {
      return NextResponse.json({ error: "idPagina is required" }, { status: 400 });
    }
    const idPagina = body.idPagina.trim();
    const studyConsent = isStudyConsentGranted(request);

    // Rate limit: max 10 views per IP per minute to prevent metric spam
    const ip = getClientIp(request);
    let rateLimit;
    try {
      rateLimit = await checkRateLimit("view", ip, { maxRequests: 10, windowMs: 60 * 1000 });
    } catch (rateError) {
      console.error("[api/view] rate limit unavailable, allowing request:", rateError);
      // Fail-open for rate limiting — a Redis outage should not block analytics.
      rateLimit = { allowed: true, remaining: 0, resetTime: Date.now() + 60_000, limit: 10 };
    }
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) });
    }

    const { databases } = createServerClient();

    let pageDoc;
    try {
      pageDoc = await databases.getDocument(databaseId, "pages", idPagina);
      if (!isPublicAt(pageDoc)) {
        return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
      }
    } catch {
      // M5: resposta IDÊNTICA em ambos os casos (doc inexistente vs permissão
      // negada) — sem timing/body diferente que permita enumerar páginas.
      return NextResponse.json({ error: "Page not found or not published" }, { status: 404 });
    }

    const agenteUtilizador = request.headers.get("user-agent") ?? "";
    const analyticsReferer = request.headers.get("referer") ?? "";
    // Nome do dispositivo via User-Agent Client Hints (ex: "Pixel 7",
    // "iPhone 15 Pro") — o header só existe quando o browser o envia.
    const nomeDispositivo = request.headers.get("sec-ch-ua-model") ?? "";

    // GeoIP real (país/cidade) a partir do IP — nunca exposto ao cliente.
    const geo = await resolveGeo(ip, request);

    // Regista a visualização com todos os dados reais recolhidos.
    await recordAnalyticsEvent(databases, {
      idPagina,
      ownerUserId: String(pageDoc.idUtilizador),
      type: "views",
      agenteUtilizador,
      ip,
      referer: analyticsReferer,
      geo,
      device: detectDeviceType(agenteUtilizador),
      browser: detectBrowser(agenteUtilizador),
      os: detectOS(agenteUtilizador),
      nomeDispositivo,
      studyConsent,
    });

    console.log(`[api/view] recorded view for page ${idPagina}`);
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
