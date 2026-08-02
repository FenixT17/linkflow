import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, databaseId } from "@/lib/appwrite.server";

export async function PATCH(request: NextRequest) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => null);
    const displayName = typeof body?.displayName === "string"
      ? body.displayName.trim().slice(0, 255)
      : "";
    if (!displayName) {
      return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
    }

    const { databases } = createServerClient();
    const docs = await databases.listDocuments(databaseId, "users", [
      Query.equal("userId", auth.user.$id),
      Query.limit(1),
    ]);
    const doc = docs.documents[0];
    if (!doc) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    await databases.updateDocument(databaseId, "users", doc.$id, { displayName });
    return NextResponse.json({ displayName });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number"
      ? (error as { status: number }).status
      : 500;
    return NextResponse.json({ error: status === 503 ? "Appwrite not configured" : "Failed to update profile" }, { status });
  }
}
