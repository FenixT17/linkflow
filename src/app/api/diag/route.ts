import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { createPublicAuthClient } from "@/lib/auth.server";

/**
 * TEMPORARY diagnostic route — captures the exact Appwrite error during
 * account creation so we can see why /api/auth/register fails with 400.
 * REMOVE after diagnosis.
 */
export async function GET() {
  const ts = Date.now();
  const email = `diag${ts}@teste.pt`;
  const password = "SenhaForte123!";
  const name = "Diag";

  const results: Record<string, unknown> = { email };

  // 1) Just the account creation (no session)
  try {
    const { account } = createPublicAuthClient();
    const user = await account.create(ID.unique(), email, password, name);
    results.create = { ok: true, id: user.$id };
  } catch (error) {
    results.create = extractError(error);
  }

  // 2) Verify the endpoint by hitting /account (public-ish)
  try {
    const { client } = createPublicAuthClient();
    const raw = await fetch(`${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/account`, {
      headers: {
        "X-Appwrite-Project": process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "",
        "Content-Type": "application/json",
      },
    });
    results.accountProbe = { status: raw.status, body: await raw.text() };
  } catch (error) {
    results.accountProbe = { fetchError: String(error) };
  }

  return NextResponse.json(results);
}

function extractError(error: unknown): Record<string, unknown> {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return {
      message: e.message,
      type: e.type,
      code: e.code,
      response: e.response ? JSON.stringify(e.response).slice(0, 400) : undefined,
    };
  }
  return { raw: String(error) };
}
