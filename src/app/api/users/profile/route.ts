import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeDisplayName } from "@/lib/sanitize";

const MAX_BODY_BYTES = 16 * 1024;

export async function PATCH(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) {
    return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
  }

  const ip = getClientIp(request);
  let rate;
  try {
    rate = await checkRateLimit("user_profile", `${auth.user.$id}:${ip}`, {
      maxRequests: 30,
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
    const body = await request.json().catch(() => null);
    // O nome é sanitizado (removem-se tags/scripts) antes de ser persistido e
    // renderizado no dashboard/página pública — defesa em profundidade.
    const nomeExibicao = typeof body?.nomeExibicao === "string"
      ? sanitizeDisplayName(body.nomeExibicao)
      : "";
    if (!nomeExibicao) {
      return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
    }

    const { databases } = createServerClient();
    const docs = await databases.listDocuments(databaseId, "users", [
      Query.equal("idUtilizador", auth.user.$id),
      Query.limit(1),
    ]);
    const doc = docs.documents[0];
    if (!doc) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    await databases.updateDocument(databaseId, "users", doc.$id, { nomeExibicao });
    return NextResponse.json({ nomeExibicao });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return NextResponse.json({ error: status === 503 ? "Appwrite not configured" : "Failed to update profile" }, { status });
  }
}
