import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken, CSRF_HEADER_NAME } from "@/lib/csrf";

/**
 * POST /api/csrf/verify
 * Valida o token CSRF comparando o cookie com o header X-CSRF-Token.
 * Usado pelos formulários do dashboard para verificar o token antes de enviar
 * dados sensíveis via Appwrite SDK (que não passa pelos nossos handlers).
 */
export async function POST(request: NextRequest) {
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

  if (!csrfHeader) {
    return NextResponse.json(
      { valid: false, error: "Header CSRF ausente." },
      { status: 400 }
    );
  }

  const isValid = validateCsrfToken(request);

  if (!isValid) {
    return NextResponse.json(
      { valid: false, error: "Token CSRF inválido. Recarregue a página." },
      { status: 403 }
    );
  }

  return NextResponse.json({ valid: true });
}
