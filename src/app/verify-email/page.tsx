"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/ui/logo";
import { readAppwriteTokenParams } from "@/lib/appwrite-params";
import { completeEmailVerification, getEmailVerificationStatus, sendEmailVerification } from "@/lib/services";
import { ArrowLeft, CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // O Appwrite anexa `userId`+`secret` ao URL de retorno (`/verify-email`).
  const { idUtilizador, secret } = readAppwriteTokenParams(searchParams);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  useEffect(() => {
    if (!idUtilizador || !secret) {
      setStatus("error");
      return;
    }
    completeEmailVerification(idUtilizador, secret)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [idUtilizador, secret]);

  // Após confirmar no Appwrite, se o utilizador estiver logado e o estado
  // emailVerification = true, segue direto para o dashboard (não fica preso).
  useEffect(() => {
    if (status !== "success") return;
    let alive = true;
    getEmailVerificationStatus()
      .then((s) => {
        if (alive && s.verified) router.replace("/dashboard");
      })
      .catch(() => {
        // Sem sessão — mostra o botão "Entrar".
      });
    return () => {
      alive = false;
    };
  }, [status, router]);

  const handleResend = async () => {
    setResend("sending");
    try {
      await sendEmailVerification();
      setResend("sent");
    } catch {
      setResend("failed");
    }
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[var(--background)] px-4">
      <div className="gradient-orb" aria-hidden="true"><div className="gradient-orb-1" /><div className="gradient-orb-2" /><div className="gradient-orb-3" /><div className="gradient-orb-radial" /></div>
      <div className="relative z-10 w-full max-w-[420px]"><Link href="/login" className="mb-6 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:bg-white/[0.06] hover:text-[var(--foreground)]"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Link><div className="mb-8 flex flex-col items-center text-center"><Logo size={48} className="mb-4 brightness-150 contrast-125" /><h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">Verificação de email</h1></div><GlassCard className="p-6 sm:p-8"><div className="relative z-10 text-center">
          {status === "loading" && <><Loader2 className="mx-auto h-12 w-12 animate-spin text-[var(--muted-foreground)]" /><p className="mt-5 text-sm text-[var(--muted-foreground)]">A confirmar o seu email...</p></>}

          {status === "success" && <><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-5 text-lg font-semibold text-[var(--foreground)]">Email confirmado</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">A sua conta está pronta para utilizar.</p><GlassButton href="/login" variant="primary" className="mt-6 w-full">Entrar</GlassButton></>}

          {status === "error" && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-400" />
              <h2 className="mt-5 text-lg font-semibold text-[var(--foreground)]">Link inválido ou expirado</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">Entre na sua conta para receber um novo email de verificação.</p>
              {resend === "sent" ? (
                <p className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                  Email de verificação enviado. Verifique a sua caixa de entrada.
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resend === "sending"}
                    className="glass-btn mt-5 inline-flex w-full items-center justify-center gap-2 !h-10 text-sm"
                  >
                    {resend === "sending" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> A enviar...</>
                    ) : (
                      <><MailCheck className="h-4 w-4" /> Reenviar email</>
                    )}
                  </button>
                  {resend === "failed" && (
                    <p className="mt-3 text-xs text-red-400">
                      Não foi possível enviar. Entre na sua conta e tente novamente.
                    </p>
                  )}
                </>
              )}
              <GlassButton href="/login" variant="secondary" className="mt-4 w-full">Voltar ao login</GlassButton>
            </>
          )}
        </div></GlassCard></div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[var(--background)]"><Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" /></main>}><VerifyEmailForm /></Suspense>;
}
