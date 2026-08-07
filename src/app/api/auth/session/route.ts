import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import {
  createPublicAuthClient,
  extractLegacySessionSecret,
  setAuthSessionCookie,
} from "@/lib/auth.server";

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Pedido demasiado grande." }, { status: 413 });
  }
  const body = (() => {
    try {
      return JSON.parse(rawBody) as { fallback?: unknown };
    } catch {
      return null;
    }
  })();
  const fallback = typeof body?.fallback === "string" ? body.fallback : null;
  const secret = extractLegacySessionSecret(fallback);
  if (!secret) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    const { client, account } = createPublicAuthClient();
    client.setSession(secret);
    const user = await account.get();
    const response = NextResponse.json({
      authenticated: true,
      user: { $id: user.$id, email: user.email, name: user.name, $createdAt: user.$createdAt },
    });
    setAuthSessionCookie(response, secret);
    return response;
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
