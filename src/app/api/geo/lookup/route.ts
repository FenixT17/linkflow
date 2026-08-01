import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { currencyForCountry } from "@/lib/currencies";

export const dynamic = "force-dynamic";

/**
 * GET /api/geo/lookup
 *
 * Devolve o país e a moeda do utilizador, derivados do IP real no servidor
 * (x-forwarded-for / cabeçalhos geo da infraestrutura) — nunca do body.
 *
 * Usado no registo de conta (e no sync OAuth): o SaaS recolhe o país do
 * utilizador para apresentar os preços dos planos na moeda local.
 *
 * Privacidade: devolve apenas país/código/moeda — nunca o IP nem a cidade.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);

  const rate = checkRateLimit("geo_lookup", ip, {
    maxRequests: 30,
    windowMs: 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const geo = await resolveGeo(ip, request);
    const countryCode = geo.countryCode?.toUpperCase() ?? "";
    return NextResponse.json({
      country: geo.country ?? "",
      countryCode,
      currency: currencyForCountry(countryCode),
    });
  } catch {
    // Sem GeoIP disponível → fallback neutro (EUR)
    return NextResponse.json({
      country: "",
      countryCode: "",
      currency: "EUR",
    });
  }
}
