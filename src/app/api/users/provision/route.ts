import { NextRequest, NextResponse } from "next/server";
import { ID, Permission, Query, Role } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { currencyForCountry } from "@/lib/currencies";

const COLLECTION_USERS = "users";

/**
 * POST /api/users/provision
 *
 * Creates the profile after registration. Identity, plan and timestamps come
 * from the authenticated Appwrite account; the request body is ignored.
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ip = getClientIp(request);
  let rate;
  try {
    rate = await checkRateLimit("user_provision", auth.user.$id + ":" + ip, {
      maxRequests: 5,
      windowMs: 60 * 1000,
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
    const idUtilizador = auth.user.$id;
    const existing = await databases.listDocuments(databaseId, COLLECTION_USERS, [
      Query.equal("idUtilizador", idUtilizador),
      Query.limit(1),
    ]);

    if (existing.documents.length > 0) {
      const existingDoc = existing.documents[0];
      // Reassert the security boundary for legacy documents on every login.
      // This also repairs documents if migration has not run yet.
      const repaired = await databases.updateDocument(
        databaseId,
        COLLECTION_USERS,
        existingDoc.$id,
        {
          idUtilizador,
          email: auth.user.email || String(existingDoc.email ?? ""),
          nomeExibicao: String(existingDoc.nomeExibicao ?? auth.user.name ?? "Utilizador"),
          plano: ["free", "pro", "business", "enterprise"].includes(String(existingDoc.plano))
            ? String(existingDoc.plano)
            : "free",
        },
        [Permission.read(Role.user(idUtilizador))]
      );
      return NextResponse.json(
        { profile: mapProfile(repaired) },
        { headers: mergeRateLimitHeaders(undefined, rate) },
      );
    }

    const geo = await resolveGeo(ip, request).catch(() => ({ country: "", codigoPais: "" }));
    const codigoPais = geo.codigoPais?.toUpperCase() ?? "";
    const profile = await databases.createDocument(
      databaseId,
      COLLECTION_USERS,
      ID.unique(),
      {
        idUtilizador,
        email: auth.user.email || "",
        nomeExibicao: auth.user.name || "Utilizador",
        plano: "free",
        pais: geo.country ?? "",
        codigoPais,
        moeda: currencyForCountry(codigoPais),
        criadoEm: auth.user.$createdAt || new Date().toISOString(),
      },
      [Permission.read(Role.user(idUtilizador))]
    );

    return NextResponse.json(
      { profile: mapProfile(profile) },
      { status: 201, headers: mergeRateLimitHeaders(undefined, rate) },
    );
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return NextResponse.json({ error: status === 503 ? "Appwrite not configured" : "Failed to provision user profile" }, { status });
  }
}

function mapProfile(doc: Record<string, unknown>) {
  return {
    email: String(doc.email ?? ""),
    nomeExibicao: String(doc.nomeExibicao ?? "Utilizador"),
    criadoEm: String(doc.criadoEm ?? ""),
    plano: ["free", "pro", "business", "enterprise"].includes(String(doc.plano))
      ? String(doc.plano)
      : "free",
    pais: doc.pais ? String(doc.pais) : undefined,
    codigoPais: doc.codigoPais ? String(doc.codigoPais) : undefined,
    moeda: doc.moeda ? String(doc.moeda) : undefined,
  };
}
