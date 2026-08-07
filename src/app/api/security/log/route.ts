import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { ID } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { getClientIp } from "@/lib/rate-limit";
import { hashForLog } from "@/lib/sanitize";

const VALID_EVENTS = [
  "login_attempt", "login_success", "login_failure",
  "register_attempt", "register_success", "register_failure",
  "logout", "oauth_failure", "suspicious_input",
  "rate_limit_hit", "password_reset_request",
] as const;

export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  // Require authenticated session
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  const { user } = auth;

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const eventType = typeof body.eventType === "string" ? body.eventType.trim() : "";
    if (!eventType || !VALID_EVENTS.includes(eventType as typeof VALID_EVENTS[number])) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    const { databases } = createServerClient();

    // IP confiável da infraestrutura (cf-connecting-ip da Cloudflare) — nunca
    // do body nem de headers falsificáveis pelo cliente.
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "";

    // Sanitize email: hash it to avoid storing PII in plain text
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const emailHash = rawEmail ? await hashForLog(rawEmail) : "";

    await databases.createDocument(databaseId, "security_logs", ID.unique(), {
      userId: user.$id,
      eventType,
      email: emailHash,
      ipAddress,
      userAgent,
      metadata: body.metadata ? JSON.stringify(body.metadata) : "",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/security/log] error:", error);
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Failed to create security log";
    return NextResponse.json({ error: message }, { status });
  }
}
