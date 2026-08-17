import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { currencyForCountry } from "@/lib/currencies";

export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ip = getClientIp(request);
  let rate;
  try {
    rate = await checkRateLimit("user_geo", `${auth.user.$id}:${ip}`, {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
    });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rate) },
    );
  }

  try {
    const { databases } = createServerClient();
    const docs = await databases.listDocuments(databaseId, "users", [
      Query.equal("idUtilizador", auth.user.$id),
      Query.limit(1),
    ]);
    const doc = docs.documents[0];
    if (!doc) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const geo = await resolveGeo(ip, request);
    const codigoPais = geo.codigoPais?.toUpperCase() ?? "";
    const updated = await databases.updateDocument(databaseId, "users", doc.$id, {
      pais: geo.country ?? "",
      codigoPais,
      moeda: currencyForCountry(codigoPais),
    });

    return NextResponse.json(
      {
        pais: String(updated.pais ?? ""),
        codigoPais: String(updated.codigoPais ?? ""),
        moeda: String(updated.moeda ?? "EUR"),
      },
      { headers: mergeRateLimitHeaders(undefined, rate) },
    );
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return NextResponse.json({ error: status === 503 ? "Appwrite not configured" : "Failed to sync geo" }, { status });
  }
}
