"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/ui/logo";
import { ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { isValidEmail } from "@/lib/sanitize";
import { requestPasswordReset } from "@/lib/services";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!isValidEmail(email)) {
      setError("Insira um email válido.");
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError("Não foi possível processar o pedido. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--background)] px-4">
      <div className="gradient-orb" aria-hidden="true"><div className="gradient-orb-1" /><div className="gradient-orb-2" /><div className="gradient-orb-3" /><div className="gradient-orb-radial" /></div>
      <div className="relative z-10 w-full max-w-[420px]">
        <Link href="/login" className="mb-6 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-white/[0.06] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Link>
        <div className="mb-8 flex flex-col items-center text-center"><Logo size={48} className="mb-4" /><h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Recuperar palavra-passe</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">Recebe um link seguro para criar uma nova palavra-passe.</p></div>
        <GlassCard className="p-6 sm:p-8">
          {sent ? (
            <div className="relative z-10 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-5 text-lg font-semibold text-[var(--foreground)]">Verifica o teu email</h2><p className="mt-2 text-sm leading-relaxed text-[var(--muted-foreground)]">Se existir uma conta com esse email, receberás instruções para recuperar a palavra-passe.</p><GlassButton href="/login" variant="secondary" className="mt-6 w-full">Voltar ao login</GlassButton></div>
          ) : (
            <form className="relative z-10 space-y-4" onSubmit={handleSubmit}>
              <label htmlFor="reset-email" className="text-sm font-medium text-[var(--foreground)]">Email</label>
              <div className="relative"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><input id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="glass-input w-full py-2.5 pl-10 pr-4 text-sm" disabled={loading} required /></div>
              {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}
              <GlassButton type="submit" variant="primary" className="w-full" disabled={loading}>{loading ? <><Loader2 className="h-4 w-4 animate-spin" /> A enviar...</> : "Enviar link de recuperação"}</GlassButton>
            </form>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
