import { NextRequest, NextResponse } from "next/server";
import { ID, Permission, Query, Role } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId, isUnknownAttributeError } from "@/lib/appwrite.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";

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

    // Do corpo apenas se lê o booleano de consentimento; a data/hora é sempre
    // definida pelo servidor (nunca se confia em timestamps do cliente).
    const body = (await request.json().catch(() => ({}))) as { consent?: unknown };
    const consentGranted = body.consent === true;

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

    // O país e a moeda não são críticos: contas antigas que não têm
    // codigoPais são preenchidas em background pelo AuthContext em cada
    // login (syncUserGeo, fail-silently). O utilizador consegue entrar e
    // criar a página antes do GeoIP resolver.
    const baseProfile = {
      idUtilizador,
      email: auth.user.email || "",
      nomeExibicao: auth.user.name || "Utilizador",
      plano: "free",
      pais: "",
      codigoPais: "",
      moeda: "EUR",
      criadoEm: auth.user.$createdAt || new Date().toISOString(),
    };
    const permissions = [Permission.read(Role.user(idUtilizador))];

    // Prova de consentimento (RGPD): data/hora definida pelo servidor. Só o
    // server SDK escreve este campo — o dono tem apenas Permission.read no
    // próprio documento, por isso não é falsificável.
    let profile;
    try {
      profile = await databases.createDocument(
        databaseId,
        COLLECTION_USERS,
        ID.unique(),
        consentGranted ? { ...baseProfile, consentimentoAceitoEm: new Date().toISOString() } : baseProfile,
        permissions,
      );
    } catch (error) {
      // Atributo ainda não provisionado (falta correr `npm run provision`):
      // não bloqueia a criação da conta — cria o perfil sem a prova e avisa.
      if (!consentGranted || !isUnknownAttributeError(error)) throw error;
      console.warn(
        "[users/provision] atributo consentimentoAceitoEm em falta — corre `npm run provision`. Perfil criado sem prova de consentimento.",
      );
      profile = await databases.createDocument(databaseId, COLLECTION_USERS, ID.unique(), baseProfile, permissions);
    }

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
