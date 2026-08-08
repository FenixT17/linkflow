"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassButton } from "@/components/ui/glass-button";
import { isValidEmail } from "@/lib/sanitize";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/context/AuthContext";
import { createSecurityLog } from "@/lib/services";
import { parseOAuthError } from "@/lib/oauth-errors";
import { getLastKnownEmail, rememberEmail } from "@/lib/email-hint";
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, loginWithGitHub } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // "Lembrar-me" ligado por defeito: a sessão persiste após fechar o browser.
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Hint quando o registo redireciona para o login (reason=oauth_exists):
  // o utilizador já tem conta — só precisa da palavra-passe. Derivado
  // diretamente do searchParams (sem estado) para nunca ficar obsoleto.
  const oauthExistsHint = searchParams.get("reason") === "oauth_exists";

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (errorParam === "missing_project") {
      setError("Erro de configuração: NEXT_PUBLIC_APPWRITE_PROJECT_ID não está definido.");
      return;
    }

    // O Appwrite Cloud devolve o erro como JSON no ?error= (o error_description
    // vem vazio) — o parseOAuthError normaliza e traduz para português.
    const parsed = parseOAuthError(errorParam, errorDesc);
    if (parsed) {
      createSecurityLog({
        userId: "anonymous",
        eventType: "oauth_failure",
        userAgent: navigator.userAgent,
        metadata: { error: parsed.message, rawError: errorParam, type: parsed.type },
      });
      setError(parsed.friendly);

      // user_already_exists → pré-preenche o email para o utilizador só ter
      // de introduzir a palavra-passe. Fontes por ordem de fiabilidade:
      //   1) email vindo no erro (defensivo)  2) ?email= no URL (do registo)
      //   3) último email conhecido no browser.
      if (parsed.type === "user_already_exists") {
        const emailFromUrl = searchParams.get("email");
        const email = parsed.email || emailFromUrl || getLastKnownEmail();
        if (email) {
          setEmail(email);
          // Foca o campo de password para o utilizador só ter de a introduzir.
          requestAnimationFrame(() => {
            passwordRef.current?.focus();
          });
        }
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) {
      setError("Insira um email válido.");
      return;
    }
    // Guarda o email para pré-preencher futuros fluxos OAuth user_already_exists.
    rememberEmail(email);
    if (!password || password.length < 8) {
      setError("A palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const result = await login(email, password, remember);
    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error ?? "Ocorreu um erro ao entrar.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState("CapsLock"));
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#030303] px-4">
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="mb-6">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/60 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/90 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)]"
            aria-label="Voltar à página inicial"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span>Voltar ao início</span>
          </Link>
        </div>

        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={48} className="mb-4 brightness-150 contrast-125" />
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Entre para continuar no LinkFlow
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8">
          <div className="relative z-10">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-white/80"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    required
                    disabled={loading}
                    className="glass-input w-full pl-10 pr-4 py-2.5 text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-white/80"
                >
                  Palavra-passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    id="password"
                    ref={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyDown}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="glass-input w-full pl-10 pr-10 py-2.5 text-sm disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    disabled={loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                    aria-label={
                      showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {capsLock && (
                  <p className="text-xs text-amber-400">Caps Lock ativo</p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-white/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={loading}
                    className="glass-input h-4 w-4 !p-0"
                  />
                  <span>Lembrar-me</span>
                </label>
                <Link
                  href="/forgot-password"
                  className={`text-white/70 hover:text-white transition-colors text-sm ${loading ? "pointer-events-none opacity-50" : ""}`}
                >
                  Esqueceu a palavra-passe?
                </Link>
              </div>

              {oauthExistsHint && !error && (
                <p className="text-sm text-emerald-400 bg-emerald-500/10 p-3 rounded-lg">
                  Já tem uma conta neste serviço — introduza a sua palavra-passe para entrar.
                </p>
              )}

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                  {error}
                </p>
              )}

              <GlassButton
                type="submit"
                variant="primary"
                className="w-full tracking-wide"
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>A entrar…</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-3">
                    <span>Entrar</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                  </span>
                )}
              </GlassButton>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-xs text-white/40">ou continuar com</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => loginWithGoogle()}
                disabled={loading}
                className="group relative flex h-11 w-full items-center justify-center gap-4 rounded-[var(--glass-radius)] border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-white/90 transition-all duration-[250ms] ease-[var(--ease-glass)] hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] select-none"
              >
                <svg
                  className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84.01-.01z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l2.85 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continuar com Google</span>
              </button>

              <button
                type="button"
                onClick={() => loginWithGitHub()}
                disabled={loading}
                className="group relative flex h-11 w-full items-center justify-center gap-4 rounded-[var(--glass-radius)] border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-white/90 transition-all duration-[250ms] ease-[var(--ease-glass)] hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] select-none"
              >
                <svg
                  className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>Continuar com GitHub</span>
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-white/50">
              Ainda não tem conta?{" "}
              <Link
                href="/register"
                className="text-white/90 hover:underline font-medium transition-colors"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#030303]">
          <div className="flex items-center gap-3 text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>A carregar...</span>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
