import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { requireAuth } from "@/lib/auth.server";
import { createServerClient, filesBucketId } from "@/lib/appwrite.server";

const FILE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

function isOwnedByUser(permissions: string[] | undefined, userId: string): boolean {
  if (!Array.isArray(permissions)) return false;
  return permissions.some((permission) =>
    permission.includes(`user:${userId}`) &&
    /^(read|update|delete)\("?user:/.test(permission),
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const csrfCheck = csrfGuard(request);
  if (csrfCheck) return csrfCheck;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { fileId } = await params;
  if (!FILE_ID.test(fileId)) {
    return NextResponse.json({ error: "Ficheiro inválido." }, { status: 400 });
  }

  try {
    const { storage } = createServerClient();
    const file = await storage.getFile(filesBucketId, fileId);
    if (!isOwnedByUser(file.$permissions, auth.user.$id)) {
      return NextResponse.json({ error: "Ficheiro não autorizado." }, { status: 403 });
    }
    await storage.deleteFile(filesBucketId, fileId);
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch {
    // Cleanup is best-effort from the client; do not leak whether a file ID
    // exists to callers who do not own it.
    return NextResponse.json({ deleted: true }, { status: 200 });
  }
}
