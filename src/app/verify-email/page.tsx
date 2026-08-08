"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/ui/logo";
import {
  completeEmailVerification,
  confirmVerificationToken,
  getEmailVerificationStatus,
  sendEmailVerification,
} from "@/lib/services";
import { ArrowLeft, CheckCircle2, Loader2, MailCheck, XCircle } from "lucide-react";

type VerifyErrorKind = "invalid" | "expired" | "unavailable" | "generic";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const token = searchParams.get("token") || "";
  const secret = searchParams.get("secret") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorKind, setErrorKind] = useState<VerifyErrorKind>("generic");
  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  // Fluxo principal (email do MailerSend): ?userId=..&token=..
  // Fluxo legado/backup (email do Appwrite): ?userId=..&secret=..
  useEffect(() => {
    let alive = true;
    if (token && userId) {
      confirmVerificationToken(userId, token)
        .then(() => {
          if (alive) setStatus("success");
        })
        .catch((error: Error & { code?: string }) => {
          if (!alive) return;
          setErrorKind(
            error.code === "expired_link"
              ? "expired"
              : error.code === "unavailable"
                ? "unavailable"
                : "invalid"
          );
          setStatus("error");
        });
    } else if (userId && secret) {
      completeEmailVerification(userId, secret)
        .then(() => {
          if (alive) setStatus("success");
        })
        .catch(() => {
          if (!alive) return;
          setErrorKind("invalid");
          setStatus("error");
        });
    } else {
      setErrorKind("invalid");
      setStatus("error");
    }
    return () => {
      alive = false;
    };
  }, [userId, token, secret]);

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
        // Sem sessão — mostra o botão "Continuar para o LinkFlow".
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

  const errorTitle =
    errorKind === "expired" ? "Link expirado" : "Link inválido";
  const errorText =
    errorKind === "expired"
      ? "O link de confirmação expirou. Pede um novo email de verificação."
      : errorKind === "unavailable"
        ? "Não foi possível confirmar o email neste momento. Tenta novamente mais tarde."
        : "Este link não é válido ou já foi utilizado. Entre na sua conta para receber um novo email.";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#030303] px-4">
      <div className="gradient-orb" aria-hidden="true"><div className="gradient-orb-1" /><div className="gradient-orb-2" /><div className="gradient-orb-3" /><div className="gradient-orb-radial" /></div>
      <div className="relative z-10 w-full max-w-[420px]"><Link href="/login" className="mb-6 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90"><ArrowLeft className="h-4 w-4" /> Voltar ao login</Link><div className="mb-8 flex flex-col items-center text-center"><Logo size={48} className="mb-4 brightness-150 contrast-125" /><h1 className="text-2xl font-semibold tracking-tight text-white/90">Verificação de email</h1></div><GlassCard className="p-6 sm:p-8"><div className="relative z-10 text-center">
          {status === "loading" && <><Loader2 className="mx-auto h-12 w-12 animate-spin text-white/50" /><p className="mt-5 text-sm text-white/60">A confirmar o seu email...</p></>}

          {status === "success" && <><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><h2 className="mt-5 text-lg font-semibold text-white/90">Email confirmado!</h2><p className="mt-2 text-sm text-white/55">A tua conta LinkFlow foi verificada com sucesso.</p><GlassButton href="/login" variant="primary" className="mt-6 w-full">Continuar para o LinkFlow</GlassButton></>}

          {status === "error" && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-red-400" />
              <h2 className="mt-5 text-lg font-semibold text-white/90">{errorTitle}</h2>
              <p className="mt-2 text-sm text-white/55">{errorText}</p>
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
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#030303]"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></main>}><VerifyEmailForm /></Suspense>;
}
