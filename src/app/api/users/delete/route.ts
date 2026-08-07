import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { deleteAccountData } from "@/lib/account-deletion.server";
import { clearAuthSessionCookie } from "@/lib/auth.server";

/**
 * DELETE /api/users/delete
 *
 * The user id and email are always derived from the authenticated Appwrite
 * session. The request body is deliberately ignored so a client cannot ask
 * the server to erase another account.
 */
export async function DELETE(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    await deleteAccountData(auth.user.$id, auth.user.email || "");
    const response = NextResponse.json({ deleted: true });
    clearAuthSessionCookie(response);
    return response;
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const response = NextResponse.json({
      error: status === 503
        ? "Appwrite not configured"
        : "Não foi possível concluir a eliminação da conta. Tente novamente.",
    }, { status });
    if (status === 401 || status === 404) clearAuthSessionCookie(response);
    return response;
  }
}
