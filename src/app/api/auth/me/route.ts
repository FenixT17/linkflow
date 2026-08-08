import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth.server";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    {
      user: {
        $id: user.$id,
        email: user.email,
        name: user.name,
        $createdAt: user.$createdAt,
        // Estado de verificação de email — vem do Appwrite (account.get), nunca
        // do cliente. Permite à UI "Já confirmei"/auto-check confirmar.
        emailVerification: user.emailVerification === true,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
