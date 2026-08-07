import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { requireAuth } from "@/lib/auth.server";
import { csrfGuard } from "@/lib/csrf";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { currencyForCountry } from "@/lib/currencies";
import { ID, Permission, Query, Role } from "node-appwrite";

const COLLECTION_USERS = "users";

/**
 * POST /api/auth/oauth/sync
 *
 * Cria/atualiza o documento do utilizador na coleção "users" após login OAuth.
 * Usa o server SDK (com API key) para garantir permissões de escrita,
 * ao contrário do client SDK que pode falhar por falta de permissões.
 *
 * NOTA (M3): o cliente chama este endpoint via fetchWithCsrf, por isso o
 * token CSRF já está validado aqui (csrfGuard) — postura consistente com o
 * resto das mutações. Além disso, verifica obrigatoriamente o cookie de
 * sessão do Appwrite e deriva o userId a partir da sessão, nunca do corpo.
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  try {
    // 1. Verificar sessão e obter o utilizador autenticado
    // NOTA: Todos os dados são derivados EXCLUSIVAMENTE da sessão server-side.
    // O corpo do pedido é ignorado para prevenir injeção de dados.
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;
    const userId = user.$id;

    // 2. Rate limit: max 3 sync requests por IP por minuto
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit("oauth_sync", ip, { maxRequests: 3, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) });
    }

    const { databases } = createServerClient();

    // 2b. Recolhe o país do utilizador (via IP) para definir a moeda do plano
    let country = "";
    let countryCode = "";
    let currency = "EUR";
    try {
      const geo = await resolveGeo(ip, request);
      country = geo.country ?? "";
      countryCode = geo.countryCode?.toUpperCase() ?? "";
      currency = currencyForCountry(countryCode);
    } catch {
      // Sem GeoIP → fallback neutro (EUR)
    }

    // 3. Verificar se já existe um documento para este userId
    const existing = await databases.listDocuments(
      databaseId,
      COLLECTION_USERS,
      [Query.equal("userId", userId)]
    );

    if (existing.documents.length === 0) {
      // 4. Criar novo documento de utilizador — dados 100% derivados da sessão
      // Sessão 36: como a coleção users já NÃO tem read/update/delete: users()
      // (least-privilege), o documento criado via server SDK precisa das
      // permissões por documento do dono — senão o client SDK do utilizador
      // (dashboard) não conseguia ler o próprio documento de perfil.
      await databases.createDocument(
        databaseId,
        COLLECTION_USERS,
        ID.unique(),
        {
          userId: userId.trim(),
          email: user.email || "",
          displayName: user.name || "Utilizador",
          plan: "free",
          country,
          countryCode,
          currency,
          createdAt: user.$createdAt || new Date().toISOString(),
        },
        [
          Permission.read(Role.user(userId.trim())),
        ]
      );
    } else {
      // 4b. Conta já existia — garante o país/moeda preenchidos (contas antigas)
      const doc = existing.documents[0];
      const needsGeo =
        !String(doc.countryCode ?? "") && (countryCode || currency !== "EUR");
      if (needsGeo) {
        await databases.updateDocument(
          databaseId,
          COLLECTION_USERS,
          doc.$id,
          {
            userId,
            email: user.email || String(doc.email ?? ""),
            displayName: String(doc.displayName ?? user.name ?? "Utilizador"),
            plan: ["free", "pro", "business", "enterprise"].includes(String(doc.plan))
              ? String(doc.plan)
              : "free",
            country,
            countryCode,
            currency,
          },
          [Permission.read(Role.user(userId))]
        );
      }
    }

    return NextResponse.json({ success: true }, { headers: mergeRateLimitHeaders(undefined, rateLimit) });
  } catch (error) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      typeof (error as { status?: number }).status === "number"
        ? (error as { status: number }).status
        : 500;
    const message =
      status === 503
        ? "Appwrite not configured"
        : "Failed to sync OAuth user";
    return NextResponse.json({ error: message }, { status });
  }
}
