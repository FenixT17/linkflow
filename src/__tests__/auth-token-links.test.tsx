/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readAppwriteTokenParams } from "@/lib/appwrite-params";

/**
 * Testes dos links que o Appwrite envia por email (verificação de conta e
 * recuperação de palavra-passe) e do retorno do OAuth.
 *
 * O bug: o commit `ac52ea9` (rename do schema para português) traduziu também
 * `userId` — que é um parâmetro do PROTOCOLO do Appwrite, não um campo nosso.
 * Resultado: o Appwrite enviava `/verify-email?userId=..&secret=..`, as páginas
 * liam `idUtilizador`, ficavam sem credenciais e mostravam sempre "Link
 * inválido ou expirado" — ou seja, nenhuma conta conseguia ser confirmada.
 *
 * Estes testes montam as páginas com os parâmetros REAIS do Appwrite e falham
 * se o nome voltar a ser traduzido. O controlo negativo (sem parâmetros) existe
 * para garantir que as asserções não passam por acidente.
 */

const { mockSearchParams, mockReplace, mockServices } = vi.hoisted(() => ({
  mockSearchParams: vi.fn(),
  mockReplace: vi.fn(),
  mockServices: {
    completeEmailVerification: vi.fn(),
    completePasswordReset: vi.fn(),
    getEmailVerificationStatus: vi.fn(),
    sendEmailVerification: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams(),
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/logo", () => ({ Logo: () => <span data-testid="logo" /> }));

vi.mock("@/lib/services", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/services");
  return { ...actual, ...mockServices };
});

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({
    allowed: true,
    remaining: 119,
    resetTime: Date.now() + 60_000,
    limit: 120,
  }),
  getClientIp: () => "203.0.113.1",
  mergeRateLimitHeaders: () => ({}),
}));

/** `useSearchParams` a partir de uma query string (o que o Appwrite envia). */
function withQueryString(queryString: string) {
  mockSearchParams.mockReturnValue(new URLSearchParams(queryString));
}

describe("readAppwriteTokenParams — nomes do protocolo Appwrite", () => {
  it("lê `userId`+`secret`, que é o que o Appwrite anexa ao URL de retorno", () => {
    const params = readAppwriteTokenParams(new URLSearchParams("userId=u1&secret=s1"));
    expect(params).toEqual({ idUtilizador: "u1", secret: "s1" });
  });

  it("continua a aceitar `idUtilizador` dos emails enviados na janela do bug", () => {
    const params = readAppwriteTokenParams(new URLSearchParams("idUtilizador=u1&secret=s1"));
    expect(params).toEqual({ idUtilizador: "u1", secret: "s1" });
  });

  it("prefere `userId` quando os dois aparecem", () => {
    const params = readAppwriteTokenParams(
      new URLSearchParams("userId=real&idUtilizador=falso&secret=s1"),
    );
    expect(params.idUtilizador).toBe("real");
  });

  it("devolve vazio quando o link não traz credenciais", () => {
    expect(readAppwriteTokenParams(new URLSearchParams(""))).toEqual({
      idUtilizador: "",
      secret: "",
    });
  });
});

describe("/verify-email — confirmação de email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServices.completeEmailVerification.mockResolvedValue(undefined);
    mockServices.getEmailVerificationStatus.mockResolvedValue({ verified: false });
  });

  it("confirma a conta com o link que o Appwrite envia (?userId=&secret=)", async () => {
    withQueryString("userId=6a8f74eb&secret=abc123");

    const { default: VerifyEmailPage } = await import("@/app/verify-email/page");
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(mockServices.completeEmailVerification).toHaveBeenCalledWith("6a8f74eb", "abc123");
    });
    expect(await screen.findByText("Email confirmado")).toBeInTheDocument();
    expect(screen.queryByText("Link inválido ou expirado")).toBeNull();
  });

  it("confirma também com o nome antigo, para não perder os emails já enviados", async () => {
    withQueryString("idUtilizador=6a8f74eb&secret=abc123");

    const { default: VerifyEmailPage } = await import("@/app/verify-email/page");
    render(<VerifyEmailPage />);

    await waitFor(() => {
      expect(mockServices.completeEmailVerification).toHaveBeenCalledWith("6a8f74eb", "abc123");
    });
  });

  it("sem credenciais mostra o erro e não chama o Appwrite", async () => {
    withQueryString("");

    const { default: VerifyEmailPage } = await import("@/app/verify-email/page");
    render(<VerifyEmailPage />);

    expect(await screen.findByText("Link inválido ou expirado")).toBeInTheDocument();
    expect(mockServices.completeEmailVerification).not.toHaveBeenCalled();
  });
});

describe("/reset-password — recuperação de palavra-passe", () => {
  const PASSWORD = "SeguraPass1!23";

  beforeEach(() => {
    vi.clearAllMocks();
    mockServices.completePasswordReset.mockResolvedValue(undefined);
  });

  async function fillAndSubmit() {
    const { default: ResetPasswordPage } = await import("@/app/reset-password/page");
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByLabelText("Nova palavra-passe"), {
      target: { value: PASSWORD },
    });
    fireEvent.change(screen.getByLabelText("Confirmar palavra-passe"), {
      target: { value: PASSWORD },
    });
    // O submit é assíncrono: sem `act` o setState do `finally` cai fora do
    // ciclo do React e o Vitest avisa.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Atualizar palavra-passe" }));
    });
  }

  it("usa o mesmo formato de link do Appwrite (?userId=&secret=)", async () => {
    withQueryString("userId=6a8f74eb&secret=abc123");

    await fillAndSubmit();

    await waitFor(() => {
      expect(mockServices.completePasswordReset).toHaveBeenCalledWith(
        "6a8f74eb",
        "abc123",
        PASSWORD,
      );
    });
    expect(await screen.findByText("Palavra-passe atualizada")).toBeInTheDocument();
  });

  it("sem credenciais recusa redefinir, em vez de falhar com erro genérico", async () => {
    withQueryString("");

    await fillAndSubmit();

    expect(
      await screen.findByText("Este link de recuperação é inválido ou está incompleto."),
    ).toBeInTheDocument();
    expect(mockServices.completePasswordReset).not.toHaveBeenCalled();
  });
});

describe("/api/auth/oauth/callback — retorno do OAuth2", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function callCallback(queryString: string, withStateCookie = false) {
    // `PROJECT_ID` é lido no topo do módulo — sem projecto o callback nem entra.
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID", "test-project");
    const { GET } = await import("@/app/api/auth/oauth/callback/route");
    const request = new NextRequest(
      new URL(`https://linkflow.test/api/auth/oauth/callback?${queryString}`),
    );
    if (withStateCookie) {
      const { OAUTH_STATE_COOKIE_NAME } = await import("@/lib/auth.server");
      request.cookies.set(OAUTH_STATE_COOKIE_NAME, "state-value");
    }
    return { response: await GET(request), request };
  }

  it("reconhece as credenciais do Appwrite em vez de as ignorar", async () => {
    // Com as credenciais lidas, o fluxo segue para a verificação de estado.
    const { response } = await callCallback("userId=u1&secret=super-secret-value");

    expect(response.headers.get("location")).toContain("error=oauth_state_missing");
  });

  it("sem credenciais cai no fluxo de sessão existente (não é erro)", async () => {
    const { response } = await callCallback("");

    expect(response.headers.get("location")).toContain("oauth=returning");
  });

  it("troca as credenciais usando `userId`, a chave do protocolo do Appwrite", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      new Response(JSON.stringify({ secret: "s".repeat(40), expire: "2030-01-01" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await callCallback("userId=u1&secret=super-secret-value", true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    // `idUtilizador` aqui devolvia "Missing required parameter: userId" no
    // Appwrite e partia o login social.
    expect(JSON.parse(String(init.body))).toEqual({
      userId: "u1",
      secret: "super-secret-value",
    });
  });
});
