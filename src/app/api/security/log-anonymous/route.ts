import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { ID } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { getClientIp, checkRateLimit } from "@/lib/rate-limit";
import { hashForLog } from "@/lib/sanitize";

const VALID_EVENTS = [
  "login_attempt", "login_success", "login_failure",
  "register_attempt", "register_success", "register_failure",
  "logout", "oauth_failure", "suspicious_input",
  "rate_limit_hit", "password_reset_request",
] as const;

/**
 * POST /api/security/log-anonymous
 *
 * Records security events that happen before the user is authenticated
 * (login attempts, suspicious input, etc.). The userId must NOT be trusted;
 * we record it as "anonymous" or derive nothing from the body. IP and
 * user agent are captured from the request for monitoring only.
 *
 * This endpoint is rate-limited to prevent log spam (5/min por IP).
 * Os logs são append-only (imutáveis) — não existe endpoint de edição ou
 * remoção, e o rate limit por IP + CSRF + validação de eventType cobrem os
 * 11 eventTypes aceites. O email é guardado apenas como hash (nunca em
 * texto plano).
 */
export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  // Rate limit: max 5 anonymous logs per IP per minute
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit("security_log_anonymous", ip, { maxRequests: 5, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

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

    // Sanitize email: hash it to avoid storing PII in plain text
    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const emailHash = rawEmail ? await hashForLog(rawEmail) : "";

    await databases.createDocument(databaseId, "security_logs", ID.unique(), {
      userId: "anonymous",
      eventType,
      email: emailHash,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent") ?? "",
      metadata: body.metadata ? JSON.stringify(body.metadata) : "",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/security/log-anonymous] error:", error);
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Failed to create security log";
    return NextResponse.json({ error: message }, { status });
  }
}
