"use client";

import { FormEvent, useState, useRef, useEffect, useCallback } from "react";
import { initCsrfToken, ensureCsrfToken } from "@/hooks/use-csrf";

const CSRF_HEADER_NAME = "x-csrf-token";

interface CsrfFormProps extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
  /** Chamado quando o formulário é submetido e o CSRF é validado com sucesso */
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void> | void;
  /** Mostrar um indicador de carregamento enquanto valida o token */
  children: React.ReactNode;
  /** Classe CSS adicional */
  className?: string;
}

/**
 * CsrfForm — Wrapper de formulário com proteção CSRF integrada.
 *
 * Funciona com o padrão Double Submit Cookie:
 * 1. No mount, garante que o token CSRF está inicializado (via initCsrfToken)
 * 2. Adiciona um campo hidden com o token CSRF
 * 3. Antes de chamar onSubmit, verifica o token com /api/csrf/verify
 * 4. Se o token for inválido, mostra erro e não submete
 *
 * Uso:
 *   <CsrfForm onSubmit={handleSave}>
 *     <input name="email" />
 *     <button type="submit">Guardar</button>
 *   </CsrfForm>
 */
export function CsrfForm({
  onSubmit,
  children,
  className,
  ...props
}: CsrfFormProps) {
  const [csrfToken, setCsrfToken] = useState<string>("");
  const [error, setError] = useState("");
  const csrfRef = useRef<string>("");
  const initializedRef = useRef(false);

  // Initialize CSRF token on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    initCsrfToken()
      .then((token) => {
        csrfRef.current = token;
        setCsrfToken(token);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError("");

      const token = csrfRef.current;
      if (!token || token === "__missing__") {
        setError("Token CSRF não disponível. Recarregue a página.");
        return;
      }

      // Verify token server-side
      try {
        const res = await fetch("/api/csrf/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [CSRF_HEADER_NAME]: token,
          },
          credentials: "include",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(
            data.error || "Falha na verificação CSRF. Recarregue a página."
          );
          return;
        }

        // CSRF valid — proceed with form submission
        await onSubmit(e);
      } catch {
        setError("Erro de conexão ao verificar CSRF. Tente novamente.");
      }
    },
    [onSubmit]
  );

  return (
    <form onSubmit={handleSubmit} className={className} {...props}>
      {/* Hidden CSRF token input — defense in depth even if lib is bypassed */}
      {csrfToken && (
        <input
          type="hidden"
          name="_csrf"
          value={csrfToken}
          autoComplete="off"
        />
      )}

      {children}

      {/* CSRF error message */}
      {error && (
        <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}
    </form>
  );
}

/**
 * Hook utilitário para verificar CSRF antes de ações não baseadas em formulário
 * (ex: cliques em botões que disparam mutações).
 *
 * Uso:
 *   const { verifyCsrf, csrfError, csrfVerifying } = useCsrfAction();
 *   const handleClick = async () => {
 *     const ok = await verifyCsrf();
 *     if (!ok) return;
 *     // proceed with mutation
 *   };
 */
export function useCsrfAction() {
  const [csrfError, setCsrfError] = useState("");
  const [csrfVerifying, setCsrfVerifying] = useState(false);
  const initializedRef = useRef(false);

  const verifyCsrf = useCallback(async (): Promise<boolean> => {
    setCsrfError("");

    // Initialize token if needed
    if (!initializedRef.current) {
      initializedRef.current = true;
      try {
        await initCsrfToken();
      } catch {
        setCsrfError("Erro de segurança. Recarregue a página.");
        return false;
      }
    }

    setCsrfVerifying(true);
    try {
      // Lê a cookie atual (fonte de verdade) ou força um refresh se ausente —
      // garante que o header bate sempre com a cookie (ver ensureCsrfToken).
      const token = await ensureCsrfToken();

      if (!token || token === "__missing__") {
        setCsrfError("Token CSRF não disponível.");
        return false;
      }

      const res = await fetch("/api/csrf/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [CSRF_HEADER_NAME]: token,
        },
        credentials: "include",
      });

      if (!res.ok) {
        setCsrfError("Falha na verificação CSRF. Recarregue a página.");
        return false;
      }

      return true;
    } catch {
      setCsrfError("Erro ao verificar CSRF.");
      return false;
    } finally {
      setCsrfVerifying(false);
    }
  }, []);

  return { verifyCsrf, csrfError, csrfVerifying };
}
