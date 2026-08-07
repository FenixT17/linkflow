import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { clearAuthSessionCookie, requireAuth } from "@/lib/auth.server";

export async function POST(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    const response = NextResponse.json({ loggedOut: true });
    clearAuthSessionCookie(response);
    return response;
  }

  try {
    await auth.account.deleteSessions();
  } catch {
    // The cookie is cleared even if Appwrite already expired the session.
  }

  const response = NextResponse.json({ loggedOut: true });
  clearAuthSessionCookie(response);
  return response;
}
