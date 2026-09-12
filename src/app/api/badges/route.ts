import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { checkRateLimit, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { isStaffApplicationApproved } from "@/lib/staff-security";
import { decideBadgeGrant, normalizePersistedBadges } from "@/lib/badge-grants";

const COLLECTION_PAGES = "pages";
const COLLECTION_USERS = "users";
const COLLECTION_STAFF_APPLICATIONS = "staff_applications";
const MAX_BODY_BYTES = 4 * 1024;

/**
 * POST /api/badges — concede ou remove uma badge da página do utilizador
 * autenticado.
 *
 * Existe porque o documento `pages` é editável pelo utilizador e o proxy
 * `/api/appwrite` remove `emblemas` do allowlist (de propósito): sem um ponto
 * de escrita server-side, a concessão de badges era silenciosamente descartada.
 *
 * Garantias:
 * - `idUtilizador` vem SEMPRE da sessão autenticada, nunca do body.
 * - O plano é lido do registo `users` no servidor (nunca do body).
 * - A aprovação de staff é lida de `staff_applications` e só conta quando tem
 *   `revistoPor` preenchido por um revisor confiável.
 * - As regras vivem em `decideBadgeGrant` (puro e testado); esta rota só reúne
 *   contexto e escreve.
 * - A badge `staff` nunca é persistida em `pages` — é derivada no servidor a
 *   partir da candidatura aprovada (`services.server.getPublicBadges`).
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.user.$id;

  const contentLength = request.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) {
    return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
  }

  let rateLimit;
  try {
    rateLimit = await checkRateLimit("badge_grant", userId, {
      maxRequests: 20,
      windowMs: 60 * 1000,
    });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarde antes de tentar novamente." },
      { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  }

  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }
    let body: { badgeId?: unknown; action?: unknown } | null = null;
    try {
      body = JSON.parse(rawBody) as { badgeId?: unknown; action?: unknown };
    } catch {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    }
    if (!body || typeof body.badgeId !== "string") {
      return NextResponse.json({ error: "Badge inválida." }, { status: 400 });
    }
    const badgeId = body.badgeId;
    const action = body.action === "revoke" ? "revoke" : "grant";

    const { databases } = createServerClient();

    // --- Contexto confiável (nunca do body) --------------------------------
    const [userDocs, applicationDocs] = await Promise.all([
      databases.listDocuments(databaseId, COLLECTION_USERS, [
        Query.equal("idUtilizador", userId),
        Query.limit(1),
      ]),
      databases.listDocuments(databaseId, COLLECTION_STAFF_APPLICATIONS, [
        Query.equal("idUtilizador", userId),
        Query.orderDesc("criadoEm"),
        Query.limit(1),
      ]),
    ]);

    const plan = typeof userDocs.documents[0]?.plano === "string"
      ? String(userDocs.documents[0].plano)
      : "free";

    const application = applicationDocs.documents[0];
    const staffApproved = Boolean(
      application &&
      isStaffApplicationApproved({
        estado: String(application.estado ?? ""),
        revistoPor: application.revistoPor ? String(application.revistoPor) : "",
      }),
    );

    const decision = decideBadgeGrant(badgeId, { plan, staffApproved });
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.error }, { status: 403 });
    }

    // --- Página do utilizador ----------------------------------------------
    const pages = await databases.listDocuments(databaseId, COLLECTION_PAGES, [
      Query.equal("idUtilizador", userId),
      Query.limit(1),
    ]);
    const page = pages.documents[0];
    if (!page) {
      return NextResponse.json(
        { error: "Cria primeiro a tua página para desbloquear badges." },
        { status: 400 },
      );
    }

    const emblemas = normalizePersistedBadges(page.emblemas);
    const has = emblemas.includes(badgeId);

    // Badge derivada (staff) não tem nada a persistir.
    if (!decision.persist) {
      return NextResponse.json({ granted: false, badges: emblemas });
    }

    if (action === "grant" && !has) {
      const next = [...emblemas, badgeId];
      await databases.updateDocument(databaseId, COLLECTION_PAGES, page.$id, { emblemas: next });
      return NextResponse.json({ granted: true, badges: next });
    }

    if (action === "revoke" && has) {
      const next = emblemas.filter((badge) => badge !== badgeId);
      await databases.updateDocument(databaseId, COLLECTION_PAGES, page.$id, { emblemas: next });
      return NextResponse.json({ revoked: true, badges: next });
    }

    // Já no estado pedido — nada a escrever (idempotente).
    return NextResponse.json(
      action === "revoke" ? { revoked: false, badges: emblemas } : { granted: false, badges: emblemas },
      { headers: mergeRateLimitHeaders(undefined, rateLimit) },
    );
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Não foi possível atualizar a badge.";
    return NextResponse.json({ error: message }, { status });
  }
}
