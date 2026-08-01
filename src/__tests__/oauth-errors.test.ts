import { describe, it, expect } from "vitest";
import { parseOAuthError } from "@/lib/oauth-errors";

describe("parseOAuthError — erros OAuth do Appwrite", () => {
  it("devolve null quando não há erro", () => {
    expect(parseOAuthError(null, null)).toBeNull();
    expect(parseOAuthError("", "")).toBeNull();
  });

  it("traduz user_already_exists (JSON URL-encoded do Appwrite Cloud)", () => {
    const encoded = encodeURIComponent(
      JSON.stringify({
        message: "A user with the same id, email, or phone already exists in this project.",
        type: "user_already_exists",
        code: 409,
      })
    );
    const parsed = parseOAuthError(encoded, "");
    expect(parsed?.type).toBe("user_already_exists");
    expect(parsed?.friendly).toContain("Já existe uma conta com este email");
  });

  it("traduz user_already_exists quando o JSON já vem decodificado", () => {
    const raw = JSON.stringify({
      message: "A user with the same id, email, or phone already exists in this project.",
      type: "user_already_exists",
      code: 409,
    });
    const parsed = parseOAuthError(raw, null);
    expect(parsed?.type).toBe("user_already_exists");
    expect(parsed?.friendly).toContain("Já existe uma conta");
  });

  it("prioriza o error_description quando preenchido", () => {
    const parsed = parseOAuthError("some_error", "O provedor recusou o pedido");
    expect(parsed?.message).toBe("O provedor recusou o pedido");
    expect(parsed?.friendly).toContain("O provedor recusou o pedido");
  });

  it("traduz provider_disabled", () => {
    const parsed = parseOAuthError("provider_disabled", "");
    expect(parsed?.type).toBe("provider_disabled");
    expect(parsed?.friendly).toContain("desativado no Appwrite");
  });

  it("traduz cancelamento/access_denied", () => {
    const parsed = parseOAuthError("access_denied", "");
    expect(parsed?.friendly).toContain("cancelada ou sem permissão");
  });

  it("traduz sessão ativa", () => {
    const parsed = parseOAuthError("session_already_exists", "");
    expect(parsed?.friendly).toContain("sessão ativa");
  });

  it("fallback genérico mostra a mensagem real em vez de 'Falha na autenticação.'", () => {
    const parsed = parseOAuthError("unexpected_error", "");
    expect(parsed?.friendly).toBe("OAuth falhou: unexpected_error");
  });
});
