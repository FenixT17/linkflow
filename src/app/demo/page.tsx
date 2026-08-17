"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassButton } from "@/components/ui/glass-button";
import { PreviewPhone } from "@/components/dashboard/preview-phone";
import { useAuth } from "@/context/AuthContext";

export default function DemoPage() {
  const { page, links } = useAuth();

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-20">
      <div className="gradient-orb" aria-hidden="true">
        <div className="gradient-orb-1" />
        <div className="gradient-orb-2" />
        <div className="gradient-orb-3" />
        <div className="gradient-orb-radial" />
      </div>
      <GlassCard className="p-8 text-center max-w-md w-full">
        <div className="relative z-[1]">
          <h1 className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
            Página de demonstração
          </h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            É assim que a sua página LinkFlow poderá ficar.
          </p>
          <div className="mt-8 flex justify-center">
            <PreviewPhone
              nomeUtilizador={page?.nomeUtilizador ?? "utilizador"}
              nomeExibicao={page?.nomeExibicao ?? "O seu nome"}
              bio={page?.biografia ?? ""}
              links={links.length > 0 ? links : []}
            />
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/register">
              <GlassButton variant="primary" className="w-full">
                Criar a sua
              </GlassButton>
            </Link>
            <Link href="/">
              <GlassButton className="w-full">Voltar ao início</GlassButton>
            </Link>
          </div>
        </div>
      </GlassCard>
    </main>
  );
}
