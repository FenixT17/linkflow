import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
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

  let rate;
  try {
    rate = await checkRateLimit("geo_lookup", ip, {
      maxRequests: 30,
      windowMs: 60 * 1000,
    });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: mergeRateLimitHeaders(undefined, rate) });
  }

  try {
    const geo = await resolveGeo(ip, request);
    const codigoPais = geo.codigoPais?.toUpperCase() ?? "";
    return NextResponse.json(
      {
        country: geo.country ?? "",
        codigoPais,
        currency: currencyForCountry(codigoPais),
      },
      { headers: mergeRateLimitHeaders(undefined, rate) },
    );
  } catch {
    // Sem GeoIP disponível → fallback neutro (EUR)
    return NextResponse.json(
      {
        country: "",
        codigoPais: "",
        currency: "EUR",
      },
      { headers: mergeRateLimitHeaders(undefined, rate) },
    );
  }
}
