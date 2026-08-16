import { NextRequest, NextResponse } from "next/server";
import { ID, Permission, Query, Role } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { normalizeStaffApplicationMessage } from "@/lib/staff-security";

const COLLECTION_STAFF_APPLICATIONS = "staff_applications";

/**
 * POST /api/staff/apply
 *
 * Creates a pending application using the authenticated Appwrite account.
 * The client cannot choose userId, status, reviewer, or document permissions.
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ip = getClientIp(request);
  let rateLimit;
  try {
    rateLimit = await checkRateLimit("staff_application", `${auth.user.$id}:${ip}`, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
    });
  } catch {
    return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
  }
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiadas candidaturas. Tenta novamente mais tarde." }, { status: 429, headers: mergeRateLimitHeaders(undefined, rateLimit) });
  }

  try {
    const body = await request.json().catch(() => null);
    const message = normalizeStaffApplicationMessage(body && typeof body === "object" ? (body as { message?: unknown }).message : undefined);
    const { databases } = createServerClient();

    const existing = await databases.listDocuments(databaseId, COLLECTION_STAFF_APPLICATIONS, [
      Query.equal("userId", auth.user.$id),
      Query.equal("status", "pending"),
      Query.limit(1),
    ]);
    if (existing.documents.length > 0) {
      return NextResponse.json({ error: "Já tens uma candidatura ao staff em análise." }, { status: 409 });
    }

    const doc = await databases.createDocument(
      databaseId,
      COLLECTION_STAFF_APPLICATIONS,
      ID.unique(),
      {
        userId: auth.user.$id,
        message,
        status: "pending",
        reviewedBy: "",
        createdAt: new Date().toISOString(),
      },
      [Permission.read(Role.user(auth.user.$id))]
    );

    return NextResponse.json({
      application: {
        $id: doc.$id,
        userId: auth.user.$id,
        message,
        status: "pending",
        createdAt: String(doc.createdAt ?? ""),
      },
    }, { status: 201, headers: mergeRateLimitHeaders(undefined, rateLimit) });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Não foi possível enviar a candidatura.";
    return NextResponse.json({ error: message }, { status });
  }
}
