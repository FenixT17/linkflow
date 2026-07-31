import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { requireAuth } from "@/lib/auth.server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ID, Query } from "node-appwrite";

const COLLECTION_USERS = "users";

/**
 * POST /api/auth/oauth/sync
 *
 * Cria/atualiza o documento do utilizador na coleção "users" após login OAuth.
 * Usa o server SDK (com API key) para garantir permissões de escrita,
 * ao contrário do client SDK que pode falhar por falta de permissões.
 *
 * NOTA: Este endpoint NÃO usa CSRF porque é chamado internamente durante
 * o fluxo OAuth, antes do token CSRF estar inicializado. No entanto,
 * verifica obrigatoriamente o cookie de sessão do Appwrite e deriva o
 * userId a partir da sessão, nunca do corpo do pedido.
 */
export async function POST(request: NextRequest) {
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
    const rateLimit = checkRateLimit("oauth_sync", ip, { maxRequests: 3, windowMs: 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { databases } = createServerClient();

    // 3. Verificar se já existe um documento para este userId
    const existing = await databases.listDocuments(
      databaseId,
      COLLECTION_USERS,
      [Query.equal("userId", userId)]
    );

    if (existing.documents.length === 0) {
      // 4. Criar novo documento de utilizador — dados 100% derivados da sessão
      await databases.createDocument(
        databaseId,
        COLLECTION_USERS,
        ID.unique(),
        {
          userId: userId.trim(),
          email: user.email || "",
          displayName: user.name || "Utilizador",
          plan: "free",
          createdAt: user.$createdAt || new Date().toISOString(),
        }
      );
    }

    return NextResponse.json({ success: true });
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
