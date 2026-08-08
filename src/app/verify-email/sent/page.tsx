"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/ui/logo";
import { getEmailVerificationStatus, sendEmailVerification } from "@/lib/services";
import { ArrowLeft, CheckCircle2, Loader2, MailCheck, RefreshCw } from "lucide-react";

const RESEND_COOLDOWN_SECONDS = 30;
const POLL_INTERVAL_MS = 10_000;
const POLL_MAX_MS = 3 * 60 * 1000;

function ConfirmEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get("email") || "").slice(0, 254);
  // `sent=0` indica que o envio automático após o registo falhou.
  const sentAutomatically = searchParams.get("sent") !== "0";

  const [resend, setResend] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<"none" | "not-verified" | "must-login" | "failed">("none");
  const [autoPolling, setAutoPolling] = useState(true);

  // Contagem decrescente do cooldown do botão "Reenviar email".
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || resend === "sending") return;
    setResend("sending");
    try {
      await sendEmailVerification();
      setResend("sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setResend("failed");
    }
  };

  const checkVerified = useCallback(async () => {
    setChecking(true);
    try {
      const status = await getEmailVerificationStatus();
      if (status.verified) {
        setAutoPolling(false);
        router.replace("/dashboard");
        return;
      }
      setCheckMsg("not-verified");
    } catch (error) {
      // Só mostra "entra na tua conta" se for mesmo 401; falhas de rede são
      // transientes e recebem a sua própria mensagem.
      setCheckMsg(
        (error as { isUnauthorized?: boolean })?.isUnauthorized ? "must-login" : "failed"
      );
    } finally {
      setChecking(false);
    }
  }, [router]);

  // Verificação automática: quando o utilizador confirma o email (noutro
  // separador/browser) e volta a esta página, é reencaminhado para o
  // dashboard. Para quando verificado, sem sessão ou após o limite de tempo.
  useEffect(() => {
    if (!autoPolling) return;
    let alive = true;
    const started = Date.now();
    const tick = async () => {
      if (!alive) return;
      try {
        const status = await getEmailVerificationStatus();
        if (status.verified) {
          if (alive) router.replace("/dashboard");
          return;
        }
      } catch (error) {
        // Sem sessão (401) — não faz sentido continuar a consultar.
        // Erros de rede/transientes — continua a tentar.
        if ((error as { isUnauthorized?: boolean })?.isUnauthorized) {
          if (alive) setAutoPolling(false);
          return;
        }
      }
      if (Date.now() - started < POLL_MAX_MS) {
        setTimeout(tick, POLL_INTERVAL_MS);
      } else if (alive) {
        setAutoPolling(false);
      }
    };
    const id = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [autoPolling, router]);

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#030303] px-4">
      <div className="gradient-orb" aria-hidden="true"><div className="gradient-orb-1" /><div className="gradient-orb-2" /><div className="gradient-orb-3" /><div className="gradient-orb-radial" /></div>
      <div className="relative z-10 w-full max-w-[440px]">
        <Link href="/login" className="mb-6 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90">
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Link>
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={48} className="mb-4 brightness-150 contrast-125" />
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">Confirma o teu email</h1>
        </div>
        <GlassCard className="p-6 sm:p-8">
          <div className="relative z-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
              <MailCheck className="h-6 w-6 text-white/80" />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-white/90">Enviámos um email para</h2>
            <p className="mt-1 text-sm font-medium text-white/70 break-all">{email || "o teu endereço"}</p>
            <p className="mt-3 text-sm text-white/55">
              Confirma o teu email para terminar o registo. Se não vires a mensagem,
              verifica a pasta de spam.
            </p>

            {!sentAutomatically && (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                Não foi possível enviar o email automaticamente. Usa o botão abaixo para reenviar.
              </p>
            )}

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resend === "sending"}
              className="glass-btn mt-6 inline-flex w-full items-center justify-center gap-2 !h-10 text-sm"
            >
              {resend === "sending" ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> A enviar...</>
              ) : cooldown > 0 ? (
                <><RefreshCw className="h-4 w-4" /> Reenviar ({cooldown}s)</>
              ) : (
                <><RefreshCw className="h-4 w-4" /> Reenviar email</>
              )}
            </button>

            {resend === "sent" && (
              <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                Email enviado. Verifica a tua caixa de entrada.
              </p>
            )}
            {resend === "failed" && (
              <p className="mt-3 text-xs text-red-400">
                Não foi possível enviar o email. Tenta novamente daqui a pouco.
              </p>
            )}

            <div className="my-6 flex items-center gap-3 text-white/25">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={checkVerified}
              disabled={checking}
              className="inline-flex w-full items-center justify-center gap-2 !h-10 rounded-xl bg-white/[0.06] text-sm font-medium text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checking ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> A verificar...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Já confirmei o meu email</>
              )}
            </button>

            {checkMsg === "not-verified" && (
              <p className="mt-3 text-xs text-white/50">
                Ainda não verificaste o teu email. Abre a mensagem que enviámos e clica no link.
              </p>
            )}
            {checkMsg === "must-login" && (
              <p className="mt-3 text-xs text-white/50">
                Entra na tua conta para confirmar o estado do email.{" "}
                <Link href="/login" className="text-white/80 underline underline-offset-2 hover:text-white">Entrar</Link>
              </p>
            )}
            {checkMsg === "failed" && (
              <p className="mt-3 text-xs text-red-400">
                Não foi possível verificar o estado. Tenta novamente.
              </p>
            )}

            <p className="mt-5 text-xs text-white/40">
              {autoPolling ? "A verificar automaticamente o estado do teu email..." : "Esta página verifica o estado do teu email."}
            </p>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#030303]"><Loader2 className="h-5 w-5 animate-spin text-white/50" /></main>}>
      <ConfirmEmailForm />
    </Suspense>
  );
}
