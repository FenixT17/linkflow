import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId, isUnknownAttributeError } from "@/lib/appwrite.server";
import {
  clearAuthSessionCookie,
  clearOAuthConsentCookie,
  hasOAuthConsentCookie,
  requireAuth,
} from "@/lib/auth.server";
import { csrfGuard } from "@/lib/csrf";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { resolveGeo } from "@/lib/geo";
import { currencyForCountry } from "@/lib/currencies";
import { DISPOSABLE_EMAIL_ERROR, isDisposableEmail } from "@/lib/disposable-email";
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
 * sessão do Appwrite e deriva o idUtilizador a partir da sessão, nunca do corpo.
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
    const idUtilizador = user.$id;

    if (isDisposableEmail(user.email || "")) {
      try {
        await auth.account.deleteSessions();
      } catch {
        // A sessão local também é limpa mesmo se o Appwrite já a encerrou.
      }
      const response = NextResponse.json(
        { error: DISPOSABLE_EMAIL_ERROR },
        { status: 403 },
      );
      clearAuthSessionCookie(response);
      return response;
    }

    // 2. Rate limit: max 3 sync requests por IP por minuto
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit("oauth_sync", ip, { maxRequests: 3, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) });
    }

    const { databases } = createServerClient();

    // 3. Verificar se já existe um documento para este idUtilizador — ANTES
    // do GeoIP. Este endpoint corre em cada arranque da aplicação e o lookup
    // externo (country.is, com timeout de 2.5s quando a infraestrutura não
    // envia headers geo) bloqueava o carregamento do dashboard de todos os
    // utilizadores. Só resolvemos o país quando ele ainda não está no perfil.
    const existing = await databases.listDocuments(
      databaseId,
      COLLECTION_USERS,
      [Query.equal("idUtilizador", idUtilizador)]
    );

    const idTrimmed = idUtilizador.trim();
    const consentGranted = hasOAuthConsentCookie(request);
    const permissions = [Permission.read(Role.user(idTrimmed))];

    const shouldResolveGeo =
      existing.documents.length === 0 ||
      !String((existing.documents[0] as Record<string, unknown> | undefined)?.codigoPais ?? "");

    // 2b. Recolhe o país do utilizador (via IP) para definir a moeda do plano
    // (apenas quando ainda não consta no perfil).
    let country = "";
    let codigoPais = "";
    let currency = "EUR";
    if (shouldResolveGeo) {
      try {
        const geo = await resolveGeo(ip, request);
        country = geo.country ?? "";
        codigoPais = geo.codigoPais?.toUpperCase() ?? "";
        currency = currencyForCountry(codigoPais);
      } catch {
        // Sem GeoIP → fallback neutro (EUR)
      }
    }

    if (existing.documents.length === 0) {
      // 4. Criar novo documento de utilizador — dados 100% derivados da sessão
      // Sessão 36: como a coleção users já NÃO tem read/update/delete: users()
      // (least-privilege), o documento criado via server SDK precisa das
      // permissões por documento do dono — senão o client SDK do utilizador
      // (dashboard) não conseguia ler o próprio documento de perfil.
      const baseProfile = {
        idUtilizador: idTrimmed,
        email: user.email || "",
        nomeExibicao: user.name || "Utilizador",
        plano: "free",
        pais: country,
        codigoPais,
        moeda: currency,
        criadoEm: user.$createdAt || new Date().toISOString(),
      };
      // Prova de consentimento (RGPD): data/hora definida pelo servidor.
      try {
        await databases.createDocument(
          databaseId,
          COLLECTION_USERS,
          ID.unique(),
          consentGranted ? { ...baseProfile, consentimentoAceitoEm: new Date().toISOString() } : baseProfile,
          permissions
        );
      } catch (error) {
        if (!consentGranted || !isUnknownAttributeError(error)) throw error;
        console.warn(
          "[oauth/sync] atributo consentimentoAceitoEm em falta — corre `npm run provision`. Perfil criado sem prova de consentimento.",
        );
        await databases.createDocument(databaseId, COLLECTION_USERS, ID.unique(), baseProfile, permissions);
      }
    } else {
      // 4b. Conta já existia — garante o país/moeda preenchidos (contas antigas)
      const doc = existing.documents[0];
      const needsGeo =
        !String(doc.codigoPais ?? "") && (codigoPais || currency !== "EUR");
      if (needsGeo) {
        await databases.updateDocument(
          databaseId,
          COLLECTION_USERS,
          doc.$id,
          {
            idUtilizador,
            email: user.email || String(doc.email ?? ""),
            nomeExibicao: String(doc.nomeExibicao ?? user.name ?? "Utilizador"),
            plano: ["free", "pro", "business", "enterprise"].includes(String(doc.plano))
              ? String(doc.plano)
              : "free",
            pais: country,
            codigoPais,
            moeda: currency,
          },
          [Permission.read(Role.user(idUtilizador))]
        );
      }
      // 4c. Backfill da prova de consentimento (conta criada antes do campo).
      if (consentGranted && !String(doc.consentimentoAceitoEm ?? "")) {
        try {
          await databases.updateDocument(databaseId, COLLECTION_USERS, doc.$id, {
            consentimentoAceitoEm: new Date().toISOString(),
          });
        } catch (error) {
          if (!isUnknownAttributeError(error)) throw error;
          console.warn("[oauth/sync] atributo consentimentoAceitoEm em falta — corre `npm run provision`.");
        }
      }
    }

    const response = NextResponse.json({ success: true }, { headers: mergeRateLimitHeaders(undefined, rateLimit) });
    if (consentGranted) clearOAuthConsentCookie(response);
    return response;
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
