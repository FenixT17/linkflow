"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { isValidEmail, isValidPassword } from "@/lib/sanitize";
import { Logo } from "@/components/ui/logo";
import { useAuth } from "@/context/AuthContext";
import { Check, X } from "lucide-react";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, loginWithGoogle, loginWithGitHub } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  // Real-time password strength checks (política L1: 12+ chars + símbolo)
  const passwordChecks = useMemo(() => {
    if (!password) return null;
    return [
      { label: "Pelo menos 12 caracteres", pass: password.length >= 12 },
      { label: "Uma letra maiúscula", pass: /[A-Z]/.test(password) },
      { label: "Uma letra minúscula", pass: /[a-z]/.test(password) },
      { label: "Um número", pass: /[0-9]/.test(password) },
      { label: "Um símbolo", pass: /[^A-Za-z0-9]/.test(password) },
    ];
  }, [password]);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (errorParam === "missing_project") {
      setError(
        "Erro de configuração: NEXT_PUBLIC_APPWRITE_PROJECT_ID não está definido no .env.local. " +
          "Adicione o ID do projeto Appwrite e reinicie o servidor."
      );
      return;
    }

    if (errorParam) {
      let pretty = "Falha na autenticação com o provedor externo.";
      if (errorDesc) {
        try {
          pretty = decodeURIComponent(errorDesc);
        } catch {
          pretty = errorDesc;
        }
      }
      setError(`OAuth falhou: ${pretty}`);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Por favor, insira o seu nome.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Insira um email válido.");
      return;
    }
    if (!isValidPassword(password)) {
      setError("A palavra-passe não cumpre os requisitos de segurança. Verifique as regras abaixo.");
      return;
    }
    setLoading(true);
    const result = await register(name.trim(), email.trim(), password);
    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error ?? "Ocorreu um erro ao criar a conta.");
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--background)] px-4">
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={48} className="mb-4 brightness-150 contrast-125" />
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Criar conta
          </h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Comece a sua jornada no LinkFlow
          </p>
        </div>
        <GlassCard className="p-6">
          <div className="relative z-[1]">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-[var(--foreground)]">
                  Nome completo
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ana Silva"
                  required
                  className="glass-input w-full px-4 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                  className="glass-input w-full px-4 py-2.5 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-[var(--foreground)]">
                  Palavra-passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordTouched(true)}
                  placeholder="Mín. 12 caracteres, 1 maiúscula, 1 número, 1 símbolo"
                  required
                  className="glass-input w-full px-4 py-2.5 text-sm"
                />
                {passwordTouched && passwordChecks && (
                  <div className="space-y-1 pt-1">
                    {passwordChecks.map((check) => (
                      <div
                        key={check.label}
                        className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
                          check.pass ? "text-emerald-400" : "text-white/40"
                        }`}
                      >
                        {check.pass ? (
                          <Check className="h-3 w-3 shrink-0" />
                        ) : (
                          <X className="h-3 w-3 shrink-0" />
                        )}
                        <span>{check.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <GlassButton
                type="submit"
                variant="primary"
                className="w-full mt-2"
                disabled={loading}
              >
                {loading ? "A criar..." : "Criar conta"}
              </GlassButton>
            </form>
            <div className="my-6 flex items-center gap-3">
              <div className="glass-divider flex-1" />
              <span className="text-xs text-[var(--muted-foreground)]">ou</span>
              <div className="glass-divider flex-1" />
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => loginWithGoogle()}
                disabled={loading}
                className="group relative flex h-11 w-full items-center justify-center gap-4 rounded-[var(--glass-radius)] border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-white/90 transition-all duration-[250ms] ease-[var(--ease-glass)] hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] select-none"
              >
                <svg className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84.01-.01z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l2.85 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Continuar com Google</span>
              </button>

              <button
                type="button"
                onClick={() => loginWithGitHub()}
                disabled={loading}
                className="group relative flex h-11 w-full items-center justify-center gap-4 rounded-[var(--glass-radius)] border border-white/[0.08] bg-white/[0.03] text-sm font-medium text-white/90 transition-all duration-[250ms] ease-[var(--ease-glass)] hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--ring)] select-none"
              >
                <svg className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>Continuar com GitHub</span>
              </button>
            </div>
            <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
              Já tem conta?{" "}
              <Link href="/login" className="text-[var(--foreground)] hover:underline">
                Entrar
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
        <div className="flex items-center gap-3 text-[var(--muted-foreground)]">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span>A carregar...</span>
        </div>
      </main>
    }>
      <RegisterForm />
    </Suspense>
  );
}
