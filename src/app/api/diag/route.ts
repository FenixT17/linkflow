import { NextResponse } from "next/server";
import { createPublicAuthClient } from "@/lib/auth.server";

/**
 * TEMPORARY diagnostic route — checks whether node-appwrite v26.1.0 returns
 * the session `secret` (used for the HttpOnly cookie). REMOVE after diagnosis.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  try {
    const email = process.env.DIAG_EMAIL ?? "";
    const password = process.env.DIAG_PASSWORD ?? "";
    if (!email || !password) {
      results.skipped = "DIAG_EMAIL/DIAG_PASSWORD not set";
      return NextResponse.json(results);
    }
    const { account } = createPublicAuthClient();
    const session = await account.createEmailPasswordSession(email, password);
    results.sessionKeys = Object.keys(session);
    results.hasSecret = typeof session.secret === "string" && session.secret.length > 0;
    results.secretLength = typeof session.secret === "string" ? session.secret.length : -1;
    results.sessionId = session.$id;
  } catch (error) {
    results.error =
      error && typeof error === "object"
        ? { type: (error as { type?: unknown }).type, message: (error as { message?: unknown }).message }
        : String(error);
  }

  return NextResponse.json(results);
}
