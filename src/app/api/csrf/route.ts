import { NextResponse } from "next/server";
import { generateToken, setCsrfCookie } from "@/lib/csrf";

/**
 * GET /api/csrf
 * Gera um token CSRF, define-o como cookie e retorna-o no body.
 * O cliente deve incluir o token como header X-CSRF-Token em mutating requests.
 */
export async function GET() {
  const token = generateToken();
  const response = NextResponse.json({ token }, { status: 200 });
  setCsrfCookie(response, token);
  return response;
}
