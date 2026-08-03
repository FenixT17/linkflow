"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/ui/logo";
import { isValidPassword } from "@/lib/sanitize";
import { completePasswordReset } from "@/lib/services";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const secret = searchParams.get("secret") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const passwordChecks = useMemo(() => [
    { label: "12 caracteres", pass: password.length >= 12 },
    { label: "Maiúscula e minúscula", pass: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: "Número e símbolo", pass: /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) },
  ], [password]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!userId || !secret) {
      setError("Este link de recuperação é inválido ou está incompleto.");
      return;
    }
    if (!isValidPassword(password)) {
      setError("A palavra-passe não cumpre os requisitos de segurança.");
      return;
    }
    if (password !== confirmation) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await completePasswordReset(userId, secret, password);
      setComplete(true);
    } catch {
      setError("Não foi possível redefinir a palavra-passe. Solicite um novo link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#030303] px-4">
      <div className="gradient-orb" aria-hidden="true"><div className="gradient-orb-1" /><div className="gradient-orb-2" /><div className="gradient-orb-3" /><div className="gradient-orb-radial" /></div>
      <div className="relative z-10 w-full max-w-[420px]">
        <Link href="/login" className="mb-6 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Link>
        <div className="mb-8 flex flex-col items-center text-center"><Logo size={48} className="mb-4 brightness-150 contrast-125" /><h1 className="text-2xl font-semibold tracking-tight text-white/90">Nova palavra-passe</h1><p className="mt-2 text-sm text-white/50">Escolha uma palavra-passe forte para proteger a conta.</p></div>
        <GlassCard className="p-6 sm:p-8">
          {complete ? (
            <div className="relative z-10 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-5 text-lg font-semibold text-white/90">Palavra-passe atualizada</h2><p className="mt-2 text-sm text-white/55">Já pode entrar na sua conta com a nova palavra-passe.</p><GlassButton href="/login" variant="primary" className="mt-6 w-full">Entrar</GlassButton></div>
          ) : (
            <form className="relative z-10 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2"><label htmlFor="new-password" className="text-sm font-medium text-white/80">Nova palavra-passe</label><div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" /><input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="glass-input w-full py-2.5 pl-10 pr-10 text-sm" disabled={loading} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80" aria-label={showPassword ? "Ocultar palavra-passe" : "Mostrar palavra-passe"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <div className="space-y-1">{passwordChecks.map((check) => <p key={check.label} className={`text-xs ${check.pass ? "text-emerald-400" : "text-white/40"}`}>{check.pass ? "✓" : "○"} {check.label}</p>)}</div>
              <div className="space-y-2"><label htmlFor="confirm-password" className="text-sm font-medium text-white/80">Confirmar palavra-passe</label><input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="glass-input w-full px-4 py-2.5 text-sm" disabled={loading} /></div>
              {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
              <GlassButton type="submit" variant="primary" className="w-full" disabled={loading}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> A atualizar...</> : "Atualizar palavra-passe"}</GlassButton>
            </form>
          )}
        </GlassCard>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#030303]"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></main>}><ResetPasswordForm /></Suspense>;
}
