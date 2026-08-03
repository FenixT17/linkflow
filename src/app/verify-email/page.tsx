"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/ui/logo";
import { completeEmailVerification } from "@/lib/services";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const secret = searchParams.get("secret") || "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (!userId || !secret) {
      setStatus("error");
      return;
    }
    completeEmailVerification(userId, secret)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [userId, secret]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#030303] px-4">
      <div className="gradient-orb" aria-hidden="true"><div className="gradient-orb-1" /><div className="gradient-orb-2" /><div className="gradient-orb-3" /><div className="gradient-orb-radial" /></div>
      <div className="relative z-10 w-full max-w-[420px]"><Link href="/login" className="mb-6 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Link><div className="mb-8 flex flex-col items-center text-center"><Logo size={48} className="mb-4 brightness-150 contrast-125" /><h1 className="text-2xl font-semibold tracking-tight text-white/90">Verificação de email</h1></div><GlassCard className="p-6 sm:p-8"><div className="relative z-10 text-center">{status === "loading" && <><Loader2 className="mx-auto h-12 w-12 animate-spin text-white/50" /><p className="mt-5 text-sm text-white/60">A confirmar o seu email...</p></>}{status === "success" && <><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-5 text-lg font-semibold text-white/90">Email confirmado</h2><p className="mt-2 text-sm text-white/55">A sua conta está pronta para utilizar.</p><GlassButton href="/login" variant="primary" className="mt-6 w-full">Entrar</GlassButton></>}{status === "error" && <><XCircle className="mx-auto h-12 w-12 text-red-400" /><h2 className="mt-5 text-lg font-semibold text-white/90">Link inválido ou expirado</h2><p className="mt-2 text-sm text-white/55">Entre na sua conta e solicite um novo email de verificação.</p><GlassButton href="/login" variant="secondary" className="mt-6 w-full">Voltar ao login</GlassButton></>}</div></GlassCard></div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#030303]"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></main>}><VerifyEmailForm /></Suspense>;
}
