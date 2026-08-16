import { NextRequest, NextResponse } from "next/server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";
import { ID } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { checkRateLimit, getClientIp, mergeRateLimitHeaders } from "@/lib/rate-limit";
import { hashForLog } from "@/lib/sanitize";

const MAX_METADATA_BYTES = 2000;
const MAX_BODY_BYTES = 16 * 1024;

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

  // Limite por utilizador para evitar encher a coleção de logs.
  const ip = getClientIp(request);
  let rate;
  try {
    rate = await checkRateLimit("security_log", `${user.$id}:${ip}`, {
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

  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) {
      return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
    }
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = null;
    }
    if (!body) {
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
      metadata: body.metadata ? JSON.stringify(body.metadata).slice(0, MAX_METADATA_BYTES) : "",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true }, { headers: mergeRateLimitHeaders(undefined, rate) });
  } catch (error) {
    console.error("[api/security/log] error:", error);
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const message = status === 503 ? "Appwrite not configured" : "Failed to create security log";
    return NextResponse.json({ error: message }, { status });
  }
}
