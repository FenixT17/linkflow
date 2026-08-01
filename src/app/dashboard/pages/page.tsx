"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, ArrowLeft, LayoutGrid } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { PremiumCard } from "@/components/ui/premium-card";
import { GlassButton } from "@/components/ui/glass-button";

export default function PagesPage() {
  const router = useRouter();

  return (
    <div className="space-y-6 animate-glass-fade-in">
      <SectionHeader
        title="Páginas"
        description="Escolha o layout da sua página pública."
      />

      <PremiumCard className="p-6 sm:p-10" strong>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center justify-center text-center py-10 sm:py-16"
        >
          <div className="relative mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] ring-1 ring-white/[0.08]">
              <LayoutGrid className="h-7 w-7 text-white/60" />
            </div>
            <span className="absolute -right-1.5 -bottom-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/15 ring-1 ring-amber-300/30">
              <Clock className="h-3.5 w-3.5 text-amber-300" />
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/[0.08]">
            <Clock className="h-3 w-3" /> Em breve
          </span>

          <h2 className="mt-4 text-xl sm:text-2xl font-semibold tracking-tight text-white/90">
            A funcionalidade de Páginas chega em breve
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
            Em breve poderá escolher entre diferentes tipos de página, cada um
            com um layout completamente próprio. Continue a usar as outras
            opções do dashboard enquanto isso.
          </p>

          <GlassButton
            variant="outline"
            size="sm"
            className="mt-8"
            onClick={() => router.push("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </GlassButton>
        </motion.div>
      </PremiumCard>
    </div>
  );
}
