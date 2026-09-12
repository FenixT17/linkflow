import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, filesBucketId } from "@/lib/appwrite.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";

const FILE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

function isOwnedByUser(permissions: string[] | undefined, idUtilizador: string): boolean {
  if (!Array.isArray(permissions)) return false;
  return permissions.some((permission) =>
    permission.includes(`user:${idUtilizador}`) &&
    /^(read|update|delete)\("?user:/.test(permission),
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ip = getClientIp(request);
  let rate;
  try {
    rate = await checkRateLimit("media_delete", `${auth.user.$id}:${ip}`, {
      maxRequests: 60,
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

  const { fileId } = await params;
  if (!FILE_ID.test(fileId)) {
    return NextResponse.json({ error: "Ficheiro inválido." }, { status: 400 });
  }

  try {
    const { storage } = createServerClient();
    const file = await storage.getFile(filesBucketId, fileId);
    if (!isOwnedByUser(file.$permissions, auth.user.$id)) {
      return NextResponse.json({ error: "Ficheiro não autorizado." }, { status: 403 });
    }
    await storage.deleteFile(filesBucketId, fileId);
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    // Log the real error server-side for debugging, but always return 200 to
    // the client: cleanup is best-effort and callers must not be blocked by
    // orphaned files. Only log unexpected errors (not "file not found").
    const message = error instanceof Error ? error.message : String(error);
    const isNotFound = message.includes("not found") || message.includes("404");
    if (!isNotFound) {
      console.error(`[media DELETE] unexpected error for file ${fileId}:`, error);
    }
    return NextResponse.json({ deleted: true }, { status: 200 });
  }
}
