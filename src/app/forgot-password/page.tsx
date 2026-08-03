"use client";

import Link from "next/link";
import { GlassButton } from "@/components/ui/glass-button";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/ui/logo";
import { ArrowLeft, Info } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#030303] px-4">
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>
      <div className="relative z-10 w-full max-w-[420px]">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/90"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Link>
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={48} className="mb-4" />
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">
            Recuperar palavra-passe
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Esta funcionalidade estará disponível numa atualização futura.
          </p>
        </div>
        <GlassCard className="p-6 sm:p-8">
          <div className="relative z-10 text-center">
            <Info className="mx-auto h-12 w-12 text-white/50" />
            <h2 className="mt-5 text-lg font-semibold text-white/90">
              Recuperação temporariamente desativada
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              O envio de emails está desativado por enquanto. Não será enviado
              nenhum email de recuperação.
            </p>
            <GlassButton href="/login" variant="secondary" className="mt-6 w-full">
              Voltar ao login
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </main>
  );
}
