import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { requireAuth } from "@/lib/auth.server";
import { Query } from "node-appwrite";

export const dynamic = "force-dynamic";

/**
 * GET /api/security/logs
 *
 * Returns security logs for the currently authenticated user only.
 * Requires a valid Appwrite session cookie.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { user } = auth;

  try {
    const { databases } = createServerClient();

    const url = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10), 1), 100);

    const docs = await databases.listDocuments(databaseId, "security_logs", [
      Query.equal("userId", user.$id),
      Query.orderDesc("createdAt"),
      Query.limit(limit),
    ]);

    const logs = docs.documents.map((doc) => ({
      $id: doc.$id,
      userId: String(doc.userId ?? ""),
      eventType: String(doc.eventType ?? ""),
      email: doc.email ? String(doc.email) : undefined,
      ipAddress: doc.ipAddress ? String(doc.ipAddress) : undefined,
      userAgent: doc.userAgent ? String(doc.userAgent) : undefined,
      metadata: doc.metadata ? String(doc.metadata) : undefined,
      createdAt: String(doc.createdAt ?? ""),
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("[api/security/logs] error:", error);
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Failed to fetch security logs";
    return NextResponse.json({ error: message }, { status });
  }
}
