import { NextResponse } from "next/server";
import { createPublicAuthClient } from "@/lib/auth.server";

/**
 * TEMPORARY diagnostic route — compares the node-appwrite SDK parse vs a raw
 * fetch of the same endpoint to see whether `secret` survives in the Worker
 * runtime. REMOVE after diagnosis.
 */
export async function GET() {
  const results: Record<string, unknown> = {};

  const email = process.env.DIAG_EMAIL ?? "";
  const password = process.env.DIAG_PASSWORD ?? "";
  if (!email || !password) {
    results.skipped = "DIAG_EMAIL/DIAG_PASSWORD not set";
    return NextResponse.json(results);
  }

  // 1) Raw REST fetch (same call the SDK makes)
  try {
    const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
    const project = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
    const raw = await fetch(`${endpoint}/account/sessions/email`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": project,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });
    const bodyText = await raw.text();
    const parsed = JSON.parse(bodyText);
    results.raw = {
      status: raw.status,
      hasSecret: typeof parsed.secret === "string" && parsed.secret.length > 0,
      secretLength: typeof parsed.secret === "string" ? parsed.secret.length : typeof parsed.secret,
      keys: Object.keys(parsed).length,
      bodyLength: bodyText.length,
      bodyHasSecretWord: bodyText.includes('"secret"'),
    };
  } catch (error) {
    results.raw = { error: String(error) };
  }

  // 2) SDK call
  try {
    const { account } = createPublicAuthClient();
    const session = await account.createEmailPasswordSession(email, password);
    results.sdk = {
      hasSecret: typeof session.secret === "string" && session.secret.length > 0,
      secretLength: typeof session.secret === "string" ? session.secret.length : typeof session.secret,
      id: session.$id,
    };
  } catch (error) {
    results.sdk = { error: String(error) };
  }

  return NextResponse.json(results);
}
